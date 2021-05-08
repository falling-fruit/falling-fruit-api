const sql = require('../sql').types
const _ = require('../../helpers')

class Types {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async show(id) {
    const type = await this.db.one(sql.show, {id: parseInt(id)})
    return _.format_type(type)
  }

  async list() {
    const types = await this.db.any(sql.list)
    return types.map(_.format_type)
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

module.exports = Types
