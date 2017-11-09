const sql = require('../sql').reviews;

class Reviews {
  constructor(db, pgp) {
    this.db = db;
    this.pgp = pgp;
  }
}

module.exports = Reviews;
