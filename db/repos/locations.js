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
}

module.exports = Locations;
