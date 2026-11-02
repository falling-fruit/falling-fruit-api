import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import aws from 'aws-sdk'
import type { Config } from './config'

type Promisable<T> = { promise(): Promise<T> }

export type S3Client = {
  upload(params: {
    ACL: string
    Bucket: string | undefined
    Body: fs.ReadStream
    Key: string
    ContentType: string
  }): Promisable<{ Location: string }>
  copyObject(params: {
    CopySource: string
    Bucket: string | undefined
    Key: string
    ACL: string
  }): Promisable<unknown>
}

type PhotoKeys = {
  thumb: string
  medium: string
  original: string
}

type Photos = {
  copy_photo_to_old_urls: (
    urls: Record<string, string>,
    observation_id: number,
  ) => Promise<unknown[]>
  resize_and_upload_photo: (input: string) => Promise<Record<string, string>>
}

const S3_URL_REGEX =
  /^https?:\/\/(?<bucket>[^.]+)\.s3\.(?<region>[^.]+)\.amazonaws\.com\/(?<key>.*)$/

function is_new_photo_url(url: string): boolean {
  const match = S3_URL_REGEX.exec(url)
  if (match?.groups == null) {
    return false
  }
  return match.groups.key.startsWith('photos/')
}

type PhotosDb = {
  get_urls: (id: number) => Promise<Record<string, string>>
  set_photo_file_name: (
    review_id: number,
    photo_file_name: string | null,
  ) => Promise<unknown>
}

async function sync_legacy_first_photo(
  db: PhotosDb,
  photos: Photos,
  photo_ids: number[] | undefined,
  review_id: number,
): Promise<void> {
  if (photo_ids && photo_ids.length) {
    const urls = await db.get_urls(photo_ids[0])
    if (is_new_photo_url(urls['original'])) {
      await photos.copy_photo_to_old_urls(urls, review_id)
      await db.set_photo_file_name(review_id, 'first.jpg')
    }
  } else {
    await db.set_photo_file_name(review_id, null)
  }
}

function createPhotos({
  s3,
  bucket,
}: {
  s3: S3Client
  bucket?: string
}): Photos {
  async function resize_photo(
    input: string,
    output: string,
    size: number | null = null,
  ): Promise<string> {
    const image = sharp(input)
    const metadata = await image.metadata()
    if (
      metadata.format === 'jpeg' &&
      size != null &&
      metadata.width <= size &&
      metadata.height <= size
    ) {
      return input
    }
    await image
      // https://sharp.pixelplumbing.com/api-resize#resize
      .resize({
        width: size ?? undefined,
        height: size ?? undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .rotate()
      .withMetadata()
      // Convert to JPEG
      .jpeg()
      .toFile(output)
    return output
  }

  async function upload_photo(input: string, output: string) {
    return s3
      .upload({
        ACL: 'public-read',
        Bucket: bucket,
        Body: fs.createReadStream(input),
        Key: output,
        ContentType: 'image/jpeg',
      })
      .promise()
  }

  // ---- For backwards compatibility only ----

  function id_partition(id: number): string {
    const pad = String(id).padStart(9, '0')
    return path.join(pad.substr(0, 3), pad.substr(3, 3), pad.substr(6, 3))
  }

  function build_s3_photo_keys(
    observation_id: number,
    filename = 'first.jpg',
  ): PhotoKeys {
    const base = path.join(
      'observations',
      'photos',
      id_partition(observation_id),
    )
    return {
      thumb: path.join(base, 'thumb', filename),
      medium: path.join(base, 'medium', filename),
      original: path.join(base, 'original', filename),
    }
  }

  function parse_s3_url(url: string): Record<string, string> {
    const match = S3_URL_REGEX.exec(url)
    if (match == null) {
      throw Error(`S3 URL not formatted as expected: ${url}`)
    }
    return match.groups as Record<string, string>
  }

  const photos: Photos = {
    copy_photo_to_old_urls(urls, observation_id) {
      const keys = build_s3_photo_keys(observation_id)
      const promises = (['thumb', 'medium', 'original'] as const).map(
        (style) => {
          const parsed = parse_s3_url(urls[style])
          return s3
            .copyObject({
              CopySource: `${parsed.bucket}/${parsed.key}`,
              Bucket: bucket,
              Key: keys[style],
              ACL: 'public-read',
            })
            .promise()
        },
      )
      return Promise.all(promises)
    },

    async resize_and_upload_photo(input) {
      const sizes: Record<string, number> = {
        thumb: 100,
        medium: 300,
        original: 2048,
      }
      const promises: Promise<string>[] = []
      for (const style in sizes) {
        const job = async function () {
          const resized = `${input}-${style}.jpg`
          const to_upload = await resize_photo(input, resized, sizes[style])
          const output = path.join(
            'photos',
            path.basename(input),
            `${style}.jpg`,
          )
          const upload = await upload_photo(to_upload, output)
          if (to_upload === resized) {
            await fs.promises.unlink(resized)
          }
          return upload.Location
        }
        promises.push(job())
      }
      const urls = await Promise.all(promises)
      await fs.promises.unlink(input)
      return Object.fromEntries(Object.keys(sizes).map((k, i) => [k, urls[i]]))
    },
  }

  return photos
}

function createLoggingS3(): S3Client {
  return {
    upload({ Body, Key }) {
      return {
        promise() {
          const location = `/uploads/${Key.split(path.sep).join('/')}`
          console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
          return new Promise((resolve, reject) => {
            Body.on('error', reject)
            Body.on('end', () => resolve({ Location: location }))
            Body.resume()
          })
        },
      }
    },
    copyObject({ CopySource, Key }) {
      return {
        promise() {
          console.log(`[s3 disabled] copyObject ${CopySource} -> ${Key}`)
          return Promise.resolve({})
        },
      }
    },
  }
}

function createS3Client(config: Config): S3Client {
  if (!config.s3) {
    return createLoggingS3()
  }
  return new aws.S3({
    region: config.s3.region,
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
    apiVersion: '2006-03-01',
  }) as unknown as S3Client
}

createPhotos.is_new_photo_url = is_new_photo_url
createPhotos.sync_legacy_first_photo = sync_legacy_first_photo
createPhotos.createS3Client = createS3Client

export default createPhotos
