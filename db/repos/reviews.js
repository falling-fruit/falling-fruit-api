const sql = require('../sql').reviews
const _ = require('../../helpers')

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
      ...obj,
      location_id: parseInt(id)
    }
    const review = await this.db.one(sql.add, values)
    return _.format_review(review)
  }

  async show(id) {
    const review = await this.db.one(sql.show, {id: parseInt(id)})
    return _.format_review(review)
  }

  async edit(id, obj) {
    const values = {...obj, id: parseInt(id)}
    const review = await this.db.one(sql.edit, values)
    return _.format_review(review)
  }

  async list(id) {
    const reviews = await this.db.any(sql.list, {id: parseInt(id)})
    return reviews.map(_.format_review)
  }
}

module.exports = Reviews
