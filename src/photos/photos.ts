import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { PhotoStorage } from './storage'

type PhotoKeys = {
  thumb: string
  medium: string
  original: string
}

/** Photo operations consumed by sync_legacy_first_photo. */
export type PhotosApi = {
  copy_photo_to_old_urls: (
    urls: Record<string, string>,
    observation_id: number,
  ) => Promise<unknown[]>
  resize_and_upload_photo: (input: string) => Promise<Record<string, string>>
}

const S3_URL_REGEX =
  /^https?:\/\/(?<bucket>[^.]+)\.s3\.(?<region>[^.]+)\.amazonaws\.com\/(?<key>.*)$/

export function is_new_photo_url(url: string): boolean {
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

export async function sync_legacy_first_photo(
  db: PhotosDb,
  photos: PhotosApi,
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

class Photos implements PhotosApi {
  private readonly storage: PhotoStorage

  constructor({ storage }: { storage: PhotoStorage }) {
    this.storage = storage
  }

  private async resize_photo(
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

  private async upload_photo(input: string, output: string) {
    return this.storage.upload(input, output)
  }

  // ---- For backwards compatibility only ----

  private id_partition(id: number): string {
    const pad = String(id).padStart(9, '0')
    return path.join(pad.substr(0, 3), pad.substr(3, 3), pad.substr(6, 3))
  }

  private build_s3_photo_keys(
    observation_id: number,
    filename = 'first.jpg',
  ): PhotoKeys {
    const base = path.join(
      'observations',
      'photos',
      this.id_partition(observation_id),
    )
    return {
      thumb: path.join(base, 'thumb', filename),
      medium: path.join(base, 'medium', filename),
      original: path.join(base, 'original', filename),
    }
  }

  private parse_s3_url(url: string): Record<string, string> {
    const match = S3_URL_REGEX.exec(url)
    if (match == null) {
      throw Error(`S3 URL not formatted as expected: ${url}`)
    }
    return match.groups as Record<string, string>
  }

  copy_photo_to_old_urls(
    urls: Record<string, string>,
    observation_id: number,
  ): Promise<unknown[]> {
    const keys = this.build_s3_photo_keys(observation_id)
    const promises = (['thumb', 'medium', 'original'] as const).map((style) => {
      const parsed = this.parse_s3_url(urls[style])
      return this.storage.copy(parsed.key, keys[style])
    })
    return Promise.all(promises)
  }

  async resize_and_upload_photo(
    input: string,
  ): Promise<Record<string, string>> {
    const sizes: Record<string, number> = {
      thumb: 100,
      medium: 300,
      original: 2048,
    }
    const promises: Promise<string>[] = []
    for (const style in sizes) {
      const job = async () => {
        const resized = `${input}-${style}.jpg`
        const to_upload = await this.resize_photo(input, resized, sizes[style])
        const output = path.join('photos', path.basename(input), `${style}.jpg`)
        const url = await this.upload_photo(to_upload, output)
        if (to_upload === resized) {
          await fs.promises.unlink(resized)
        }
        return url
      }
      promises.push(job())
    }
    const urls = await Promise.all(promises)
    await fs.promises.unlink(input)
    return Object.fromEntries(Object.keys(sizes).map((k, i) => [k, urls[i]]))
  }
}

export default Photos
