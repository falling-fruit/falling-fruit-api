const sql = require('../sql').photos
const _ = require('../../helpers')

class Photos {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  list(id) {
    return this.db.any(sql.list, {id: parseInt(id)})
  }

  add(urls) {
    return this.db.one(sql.add, urls)
  }

  async test_unlinked(photo_ids, review_id = null) {
    if (!photo_ids || !photo_ids.length) {
      return []
    }
    const photos = await this.db.any(
      // Requires intarray extension for idx()
      'SELECT id, observation_id, thumb, medium, original FROM photos WHERE id IN (${ids:csv}) ORDER BY idx(ARRAY[${ids:csv}], id)',
      {ids: photo_ids}
    )
    // Fail if one or more photos not found
    const found_ids = photos.map(photo => photo.id)
    const missing = photo_ids.filter(id => !found_ids.includes(id))
    if (missing.length > 0) {
      throw Error(`Photo(s) ${missing} not found`)
    }
    // Fail if one or more already assigned to a(nother) review
    const assigned = photos.filter(photo => (
      photo.observation_id &&
      (review_id ? photo.observation_id != review_id : true)
    ))
    if (assigned.length > 0) {
      throw Error(`Photo(s) ${assigned.map(photo => photo.id)} already assigned to another review`)
    }
    for (const photo of photos) {
      delete photo.observation_id
    }
    return photos
  }

  async link(photo_ids, review_id) {
    if (photo_ids.length) {
      await this.db.none(sql.link, {id: review_id, ids: photo_ids})
      // NOTE: For backwards compatibility only
      // Copy first photo
      const urls = await this.db.one('SELECT thumb, medium, original FROM photos WHERE id = ${id}', {id: photo_ids[0]})
      await _.copy_photo_to_old_urls(urls, review_id)
      await this.db.none("UPDATE observations SET photo_file_name = 'first.jpg' WHERE id = ${id}", {id: review_id})
    } else {
      // NOTE: For backwards compatibility only
      // Clear first photo
      await this.db.none('UPDATE observations SET photo_file_name = NULL WHERE id = ${id}', {id: review_id})
    }
    await this.db.none(sql.unlink, {id: review_id, ids: photo_ids})
  }
}

module.exports = Photos
