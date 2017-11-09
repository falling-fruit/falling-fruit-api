const sql = require('../sql').types;

class Types {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  findById(id, task) {
    return (task || this.db).oneOrNone(
      'SELECT * FROM types WHERE id = $1', +id
    );
  }

  all(task) {
    return (task || this.db).any(
      'SELECT * FROM types ORDER BY scientific_name, taxonomic_rank, en_name'
    );
  }

  cluster(values, task) {
    values.bounds = _.parse_bounds(values.bounds);
    values.muni = _.parse_muni(values.muni);
    values.types = _.parse_types(values.types);
    values.locales = _.parse_locales(values.locales);
    return (task || this.db).any(sql.cluster, values);
  }
}

module.exports = Types;
