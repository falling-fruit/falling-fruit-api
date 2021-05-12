const sql = require('../sql').reviews
const _ = require('../../helpers')

class Reviews {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(req) {
    const values = {
      author: null,
      observed_on: null,
      comment: null,
      fruiting: null,
      quality_rating: null,
      yield_rating: null,
      ...JSON.parse(req.body.json),
      location_id: parseInt(req.params.id)
    }
    const review = await this.db.one(sql.add, values)
    return _.format_review(review)
  }

  async edit(req) {
    const values = {
      ...JSON.parse(req.body.json),
      // IDs in path take precedence
      id: parseInt(req.params.rid),
      location_id: parseInt(req.params.id)
    }
    const review = await this.db.one(sql.edit, values)
    return _.format_review(review)
  }

  async list(id) {
    const reviews = await this.db.any(sql.list, {id: parseInt(id)})
    return reviews.map(_.format_review)
  }
}

module.exports = Reviews
