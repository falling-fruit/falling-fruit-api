const sql = require('../sql').locations
const { parse } = require('dotenv')
const geo = require('../../geo')
const sqlf = require('../../sql_formatters')
const Changes = require('./changes')
const Types = require('./types')
const Location = require('../../mappers/location')

class Locations {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    this.changes = new Changes(db, pgp)
    this.types = new Types(db, pgp)
  }

  async add(obj) {
    const values = Location.toRow(obj)
    const location = await this.db.one(sql.add, values)
    await this.changes.add({description: 'added', location: location, user_id: location.user_id})
    return Location.fromRow(location)
  }

  async edit(id, obj, user) {
    const values = {...obj, id: parseInt(id)}
    const location = await this.db.one(sql.edit, values)
    await this.changes.add({
      description: 'edited', location: location, user_id: user ? user.id : null
    })
    return Location.fromRow(location)
  }

  async show(id, user) {
    const location = await this.db.one(sql.show, {id: parseInt(id), user_id: user ? user.id : null})
    return Location.fromRow(location)
  }

  async list({ids = null, bounds = null, center = null, muni = 'true', types = null, invasive = 'false', limit = '1000', offset = '0', photo = 'false', locale = null}, user) {
    if (!ids && !bounds && !center) {
      throw Error('Either ids, bounds, or center are required')
    }
    if (types === '' || ids === '') {
      return []
    }
    let filters
    if (ids) {
      filters = [sqlf.ids_to_sql(ids)]
    } else {
      filters = [
        'NOT hidden',
        bounds ? sqlf.bounds_to_sql(geo.parse_bounds(bounds), { geography: center ? 'location' : null }) : null,
        sqlf.muni_to_sql(muni),
        sqlf.types_array_to_sql(types),
        sqlf.invasive_to_sql(invasive)
      ]
    }
    const values = {
      where: filters.filter(Boolean).join(' AND '),
      limit: parseInt(limit),
      offset: parseInt(offset),
      distance: {column: '', order: ''},
      in_list: ''
    }
    if (center) {
      const point = geo.parse_point(center)
      values.distance = {
        column: `,
          location <-> ST_SetSRID(
            ST_Point(${point.x}, ${point.y}), 4326
          ) as distance
        `,
        order: 'ORDER BY distance'
      }
    }
    if (user) {
      values.in_list = `,
      exists (
        select 1
        from locations_routes
        join routes on routes.id = locations_routes.route_id
        where routes.user_id = ${parseInt(user.id)} and locations_routes.location_id = locations.id
      ) as in_list
      `
    }
    if (photo === 'true') {
      return this.db.any(sql.listphoto, values)
    }
    if (!center && locale) {
      const names = this.types.locale_to_names(locale).join(', ')
      return this.db.any(sql.listname, {...values, names: names})
    }
    return this.db.any(sql.list, values)
  }

  count({bounds, muni = 'true', types = null, invasive = 'false'}) {
    const filters = [
      'NOT hidden',
      sqlf.bounds_to_sql(geo.parse_bounds(bounds), { geography: 'location' }),
      sqlf.muni_to_sql(muni),
      sqlf.types_array_to_sql(types),
      sqlf.invasive_to_sql(invasive)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.one(sql.count, values)
  }

  delete(id) {
    return this.db.none('DELETE FROM locations WHERE id = ${id}', {id: parseInt(id)})
  }

}

module.exports = Locations
