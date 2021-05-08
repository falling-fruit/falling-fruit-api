const sql = require('../sql').locations
const _ = require('../../helpers')

class Locations {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  // add(body) {
  //   const values = {
  //     season_start: null,
  //     season_stop: null,
  //     access: null,
  //     description: null,
  //     unverified: false,
  //     ...body
  //   }
  //   return this.db.one(sql.add, values)
  // }

  async show(id) {
    const location = await this.db.one(sql.show, {id: parseInt(id)})
    // TEMP: Replace no_season=true with season=[0, 11]
    if (location.no_season) {
      location.season_start = 0
      location.season_stop = 11
    }
    delete location.no_season
    return location
  }

  list({bounds, center = null, muni = 'true', types = '', limit = '1000', offset = '0'}) {
    const filters = [
      'NOT hidden',
      _.bounds_to_sql(_.parse_bounds(bounds)),
      _.muni_to_sql(muni),
      _.types_array_to_sql(types)
    ]
    const values = {
      where: filters.filter(Boolean).join(' AND '),
      limit: parseInt(limit),
      offset: parseInt(offset),
      distance: {column: '', order: ''}
    }
    if (center) {
      const point = _.parse_point(center)
      values.distance.column = `,
        ST_Distance(location, ST_SetSRID(
          ST_Point(${point.x}, ${point.y}), 4326)
        ) as distance`
      values.distance.order = 'ORDER BY distance'
    }
    return this.db.any(sql.list, values)
  }

  count({bounds, muni = 'true', types = ''}) {
    const filters = [
      'NOT hidden',
      _.bounds_to_sql(_.parse_bounds(bounds)),
      _.muni_to_sql(muni),
      _.types_array_to_sql(types)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.one(sql.count, values)
  }

}

module.exports = Locations
