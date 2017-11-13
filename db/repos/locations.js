const sql = require('../sql').locations;

class Locations {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }

  findById(id) {
    return this.db.oneOrNone(
      'SELECT * FROM locations WHERE id = $1', +id
    );
  }
}

module.exports = Locations;
