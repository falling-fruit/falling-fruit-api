const sql = require('../sql').reviews

class Reviews {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(id, obj) {
    const values = {
      observed_on: null,
      comment: null,
      fruiting: null,
      quality_rating: null,
      yield_rating: null,
      user_id: null,
      author: null,
      ...obj,
      location_id: parseInt(id)
    }
    const review = await this.db.one(sql.add, values)
    review.photos = await this.photos(id)
    return review
  }

  show(id) {
    return this.db.one(sql.show, {id: parseInt(id)})
  }

  async edit(id, obj) {
    const values = {...obj, id: parseInt(id)}
    const review = await this.db.one(sql.edit, values)
    review.photos = await this.photos(id)
    return review
  }

  list(id) {
    return this.db.any(sql.list, {id: parseInt(id)})
  }

  photos(id) {
    // Failed to return photos from add and edit, so doing so separately
    return this.db.any(sql.photos, {id: parseInt(id)})
  }
}

module.exports = Reviews
