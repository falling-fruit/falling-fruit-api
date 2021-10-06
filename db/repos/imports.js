const sql = require('../sql').imports
const _ = require('../../helpers')

class Imports {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async show(id) {
    return await this.db.one(sql.show, {id: parseInt(id)})
  }

  async list() {
    return await this.db.any(sql.list)
  }

  count({bounds, muni = 'true'}) {
    const filters = [
      "NOT hidden",
      _.bounds_to_sql(_.parse_bounds(bounds)),
      _.muni_to_sql(muni)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.any(sql.count, values)
  }
}

module.exports = Imports
