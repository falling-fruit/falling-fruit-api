import sqlModule = require('../sql')
import type { Protocol, Pgp } from '../types'
import type { Photo } from '../../schemas/schemas'

const sql = sqlModule.photos

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
    photo_ids: number[] | undefined,
    review_id: number | null = null,
  ): Promise<Photo[]> {
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
    return photos as unknown as Photo[]
  }

  get_urls(id: number): Promise<Record<string, string>> {
    return this.db.one(
      'SELECT thumb, medium, original FROM photos WHERE id = ${id}',
      { id },
    )
  }

  // NOTE: For backwards compatibility only
  set_photo_file_name(
    review_id: number,
    photo_file_name: string | null,
  ): Promise<null> {
    return this.db.none(
      'UPDATE observations SET photo_file_name = ${photo_file_name} WHERE id = ${id}',
      { id: review_id, photo_file_name },
    )
  }

  async link(photo_ids: number[] | undefined, review_id: number) {
    if (photo_ids && photo_ids.length) {
      await this.db.none(sql.link, { id: review_id, ids: photo_ids })
    }
    // Unlink photos with ids NOT in photo_ids
    await this.db.none(sql.unlink, { id: review_id, ids: photo_ids })
  }
}

export = Photos
