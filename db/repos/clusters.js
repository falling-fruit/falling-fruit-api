const sql = require('../sql').clusters;

class Clusters {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  list(values) {
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types(values.types);
    values.bounds = _.parse_bounds(values.bounds);
    return this.db.any(sql.list, values);
  }
}

module.exports = Clusters;
