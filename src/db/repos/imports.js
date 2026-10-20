const sql = require('../sql').imports
const _ = require('../../helpers')
const geo = require('../../geo')

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
      geo.bounds_to_sql(geo.parse_bounds(bounds)),
      _.muni_to_sql(muni)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.any(sql.count, values)
  }
}

module.exports = Imports
