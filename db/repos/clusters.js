const sql = require('../sql').clusters
const _ = require('../../helpers')

class Clusters {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  list({bounds, zoom = '0', muni = 'true', types = ''}) {
    const filters = [
      _.bounds_to_sql(_.parse_bounds(bounds, true), true),
      _.zoom_to_sql(zoom),
      _.muni_to_sql(muni),
      _.types_to_sql(types)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.any(sql.list, values)
  }
}

module.exports = Clusters
