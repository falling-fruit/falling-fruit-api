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
    return this.db.any(sql.list, values);
  }
}

module.exports = Locations;
