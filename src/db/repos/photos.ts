import sqlModule = require('../sql')
import photosModule = require('../../photos')
import type { Protocol, Pgp } from '../types'
import type { Photo } from '../../schemas/schemas'

const sql = sqlModule.photos
const photos = photosModule as any

type PhotoRow = {
  id: number
  observation_id?: number | null
  [key: string]: unknown
}

class Photos {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  list(id: number | string): Promise<Photo[]> {
    return this.db.any(sql.list, { id: parseInt(String(id)) })
  }

  add(
    urls: Record<string, unknown>,
    user_id: number | null = null,
  ): Promise<Photo> {
    return this.db.one(sql.add, { ...urls, user_id: user_id })
  }

  async test_unlinked(
    photo_ids: number[],
    review_id: number | null = null,
  ): Promise<PhotoRow[]> {
    if (!photo_ids || !photo_ids.length) {
      return []
    }
    const photos: PhotoRow[] = await this.db.any(sql.listByIds, {
      ids: photo_ids,
    })
    // Fail if one or more photos not found
    const found_ids = photos.map((photo) => photo.id)
    const missing = photo_ids.filter((id) => !found_ids.includes(id))
    if (missing.length > 0) {
      throw Error(`Photo(s) ${missing} not found`)
    }
    // Fail if one or more already assigned to a(nother) review
    const assigned = photos.filter(
      (photo) =>
        photo.observation_id &&
        (review_id ? photo.observation_id != review_id : true),
    )
    if (assigned.length > 0) {
      throw Error(
        `Photo(s) ${assigned.map((photo) => photo.id)} already assigned to another review`,
      )
    }
    for (const photo of photos) {
      delete photo.observation_id
    }
    return photos
  }

  async link(photo_ids: number[], review_id: number) {
    if (photo_ids && photo_ids.length) {
      await this.db.none(sql.link, { id: review_id, ids: photo_ids })
      // NOTE: For backwards compatibility only
      // Copy first photo
      const urls = await this.db.one(
        'SELECT thumb, medium, original FROM photos WHERE id = ${id}',
        { id: photo_ids[0] },
      )
      if (photos.is_new_photo_url(urls['original'])) {
        await photos.copy_photo_to_old_urls(urls, review_id)
        await this.db.none(
          "UPDATE observations SET photo_file_name = 'first.jpg' WHERE id = ${id}",
          { id: review_id },
        )
      }
    } else {
      // NOTE: For backwards compatibility only
      // Clear first photo
      await this.db.none(
        'UPDATE observations SET photo_file_name = NULL WHERE id = ${id}',
        { id: review_id },
      )
    }
    // Unlink photos with ids NOT in photo_ids
    await this.db.none(sql.unlink, { id: review_id, ids: photo_ids })
  }
}

export = Photos
