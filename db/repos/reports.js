const sql = require('../sql').reports

class Reports {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  add(obj) {
    const values = {
      comment: null,
      name: null,
      ...obj
    }
    return this.db.one(sql.add, values)
  }
}

module.exports = Reports
