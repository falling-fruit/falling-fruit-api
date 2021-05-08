const sql = require('../sql').reviews
const _ = require('../../helpers')

class Reviews {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async list(id) {
    const reviews = await this.db.any(sql.list, {id: parseInt(id)})
    return reviews.map(_.format_review)
  }
}

module.exports = Reviews
