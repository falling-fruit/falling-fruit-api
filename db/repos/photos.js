const sql = require('../sql').photos
const _ = require('../../helpers')

class Photos {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  list(id) {
    return this.db.any(sql.list, {id: parseInt(id)})
  }

  insert(id, urls) {
    // https://github.com/vitaly-t/pg-promise/wiki/Data-Imports
    const cs = new this.pgp.helpers.ColumnSet([
      {name: 'observation_id', def: id},
      'thumb', 'medium', 'original'
    ], {table: 'photos'})
    const query = (
      this.pgp.helpers.insert(urls, cs) +
      ' RETURNING thumb, medium, original'
    )
    return this.db.any(query)
  }
}

module.exports = Photos
