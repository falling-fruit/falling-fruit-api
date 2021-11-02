const sql = require('../sql').locations
const _ = require('../../helpers')

class Locations {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(obj) {
    const values = {
      season_start: null,
      season_stop: null,
      access: null,
      description: null,
      unverified: false,
      user_id: null,
      ...obj
    }
    const location = await this.db.one(sql.add, values)
    return _.format_location(location)
  }

  async edit(id, obj) {
    const values = {...obj, id: parseInt(id)}
    const location = await this.db.one(sql.edit, values)
    return _.format_location(location)
  }

  async show(id) {
    const location = await this.db.one(sql.show, {id: parseInt(id)})
    return _.format_location(location)
  }

  async list({bounds, center = null, muni = 'true', types = null, limit = '1000', offset = '0', photo = 'false'}) {
    if (types === '') {
      return []
    }
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
      distance: {column: '', order: ''},
    }
    if (center) {
      const point = _.parse_point(center)
      values.distance = {
        column: `,
          ST_Distance(location, ST_SetSRID(
            ST_Point(${point.x}, ${point.y}), 4326)
          ) as distance`,
        order: 'ORDER BY distance'
      }
    } else {
      // Ensure even spatial spread
      values.distance.order = 'ORDER BY RANDOM()'
    }
    if (photo === 'true') {
      return this.db.any(sql.listphoto, values)
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
