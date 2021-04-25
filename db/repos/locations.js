const sql = require('../sql').locations;

class Locations {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  show(id) {
    return this.db.oneOrNone(
      `SELECT * FROM locations WHERE id = ${id}`
    );
  }

  list(values) {
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types_array(values.types);
    values.bounds = _.parse_bounds_wgs84(values.bounds);
    values.limit = values.limit || 1000;
    values.offset = values.offset || 0;
    values.distance = {column: '', order: ''}
    const center = _.parse_latlng(values.center);
    if (center) {
      values.distance.column = `,
        ST_Distance(location, ST_SetSRID(
          ST_Point(${center.x}, ${center.y}), 4326)
        ) as distance`
      values.distance.order = 'ORDER BY distance'
    }
    return this.db.any(sql.list, values);
  }

  count(values) {
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types_array(values.types);
    values.bounds = _.parse_bounds_wgs84(values.bounds);
    return this.db.one(sql.count, values, res => parseInt(res.count));
  }
}

module.exports = Locations;
