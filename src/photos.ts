import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

/** A request object exposing a `promise()` accessor (aws-sdk style). */
type Promisable<T> = { promise(): Promise<T> }

/** Minimal S3 client contract used here (aws-sdk S3 or a local stub). */
type S3Client = {
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

/** S3 keys for each generated photo size. */
type PhotoKeys = {
  thumb: string
  medium: string
  original: string
}

function createPhotos({ s3 }: { s3: S3Client }) {
  const photos: {
    is_new_photo_url: (url: string) => boolean
    copy_photo_to_old_urls: (
      urls: Record<string, string>,
      observation_id: number,
    ) => Promise<unknown[]>
    resize_and_upload_photo: (input: string) => Promise<Record<string, string>>
  } = {} as any

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
        Bucket: process.env.S3_BUCKET,
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
    const regex =
      /^https?:\/\/(?<bucket>[^\.]+)\.s3\.(?<region>[^\.]+)\.amazonaws\.com\/(?<key>.*)$/
    const match = regex.exec(url)
    if (match == null) {
      throw Error(`S3 URL not formatted as expected: ${url}`)
    }
    return match.groups as Record<string, string>
  }

  photos.is_new_photo_url = function (url) {
    const match =
      /^https?:\/\/(?<bucket>[^\.]+)\.s3\.(?<region>[^\.]+)\.amazonaws\.com\/(?<key>.*)$/.exec(
        url,
      )
    if (match == null) {
      return false
    }
    return match.groups!.key.startsWith('photos/')
  }

  photos.copy_photo_to_old_urls = function (urls, observation_id) {
    const keys = build_s3_photo_keys(observation_id)
    const promises = (['thumb', 'medium', 'original'] as const).map((style) => {
      const parsed = parse_s3_url(urls[style])
      return s3
        .copyObject({
          CopySource: `${parsed.bucket}/${parsed.key}`,
          Bucket: process.env.S3_BUCKET,
          Key: keys[style],
          ACL: 'public-read',
        })
        .promise()
    })
    return Promise.all(promises)
  }

  photos.resize_and_upload_photo = async function (input) {
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
        const output = path.join('photos', path.basename(input), `${style}.jpg`)
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
  }

  return photos
}

export = createPhotos
