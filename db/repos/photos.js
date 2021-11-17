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

  async test_not_assigned(photo_ids, review_id = null) {
    if (!photo_ids || !photo_ids.length) {
      return []
    }
    const photos = await this.db.any(
      // Requires intarray extension for idx()
      'SELECT id, observation_id, thumb, medium, original FROM photos WHERE id IN (${ids:csv}) ORDER BY idx(ARRAY[${ids:csv}], id)',
      {ids: photo_ids}
    )
    // Fail if one or more already assigned to a review
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

  assign(photo_ids, review_id) {
    if (photo_ids && photo_ids.length) {
      return this.db.none(
        'UPDATE photos SET observation_id = ${id} WHERE id IN (${ids:csv})',
        {id: review_id, ids: photo_ids}
      )
    }
  }
}

module.exports = Photos
