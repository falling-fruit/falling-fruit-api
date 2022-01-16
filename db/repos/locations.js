const sql = require('../sql').locations
const _ = require('../../helpers')
const Changes = require('./changes')

class Locations {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    this.changes = new Changes(db, pgp)
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
    await this.changes.add({description: 'added', location: location})
    return _.format_location(location)
  }

  async edit(id, obj, user) {
    const values = {...obj, id: parseInt(id)}
    const location = await this.db.one(sql.edit, values)
    await this.changes.add({
      description: 'edited', location: location, user_id: user ? user.id : null
    })
    return _.format_location(location)
  }

  async show(id) {
    const location = await this.db.one(sql.show, {id: parseInt(id)})
    return _.format_location(location)
  }

  async list({bounds, center = null, muni = 'true', types = null, invasive = 'false', limit = '1000', offset = '0', photo = 'false'}) {
    if (types === '') {
      return []
    }
    const filters = [
      'NOT hidden',
      _.bounds_to_sql(_.parse_bounds(bounds), { geography: 'location' }),
      _.muni_to_sql(muni),
      _.types_array_to_sql(types),
      _.invasive_to_sql(invasive)
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
          location <-> ST_SetSRID(
            ST_Point(${point.x}, ${point.y}), 4326
          ) as distance
        `,
        order: 'ORDER BY distance'
      }
    } else {
      values.distance.order = ''
    }
    if (photo === 'true') {
      return this.db.any(sql.listphoto, values)
    }
    return this.db.any(sql.list, values)
  }

  count({bounds, muni = 'true', types = null, invasive = 'false'}) {
    const filters = [
      'NOT hidden',
      _.bounds_to_sql(_.parse_bounds(bounds), { geography: 'location' }),
      _.muni_to_sql(muni),
      _.types_array_to_sql(types),
      _.invasive_to_sql(invasive)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.one(sql.count, values)
  }

}

module.exports = Locations
