const sql = require('../sql').clusters;

class Clusters {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  cluster(values, task) {
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types(values.types);
    values.bounds = _.parse_bounds(values.bounds);
    return (task || this.db).any(sql.cluster, values);
  }
}

module.exports = Clusters;
