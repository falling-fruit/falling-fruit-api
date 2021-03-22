const sql = require('../sql').types;

class Types {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  show(id) {
    return this.db.oneOrNone(
      `SELECT * FROM types WHERE id = ${id}`
    );
  }

  list() {
    return this.db.any(
      'SELECT * FROM types'
    );
  }

  cluster(values) {
    values.bounds = _.parse_bounds(values.bounds);
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types(values.types);
    values.locales = _.parse_locales(values.locales);
    return this.db.any(sql.cluster, values);
  }
}

module.exports = Types;
