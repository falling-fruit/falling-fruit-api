const sql = require('../sql').locations;

class Locations {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  add(body) {
    const values = {
      season_start: null,
      season_stop: null,
      access: null,
      description: null,
      unverified: false,
      ...body
    }
    return this.db.one(sql.add, values)
  }

  show(id) {
    return this.db.oneOrNone(sql.show, {id: id})
  }

  list(query) {
    const filters = [
      'NOT hidden',
      _.parse_bounds_wgs84(query.bounds),
      _.parse_muni(query.muni),
      _.parse_types_array(query.types)
    ]
    const values = {
      where: filters.filter(Boolean).join(' AND '),
      limit: query.limit || 1000,
      offset: query.offset || 0,
      distance: {column: '', order: ''}
    }
    const center = _.parse_latlng(query.center);
    if (center) {
      values.distance.column = `,
        ST_Distance(location, ST_SetSRID(
          ST_Point(${center.x}, ${center.y}), 4326)
        ) as distance`
      values.distance.order = 'ORDER BY distance'
    }
    return this.db.any(sql.list, values);
  }

  count(query) {
    const filters = [
      'NOT hidden',
      _.parse_bounds_wgs84(query.bounds),
      _.parse_muni(query.muni),
      _.parse_types_array(query.types)
    ]
    const values = {
      where: filters.filter(Boolean).join(' AND ')
    }
    return this.db.one(sql.count, values, res => parseInt(res.count));
  }
}

module.exports = Locations;
