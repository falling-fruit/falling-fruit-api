const sql = require('../sql').reviews

class Reviews {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  add(id, obj) {
    const values = {
      observed_on: null,
      comment: null,
      fruiting: null,
      quality_rating: null,
      yield_rating: null,
      user_id: null,
      author: null,
      ...obj,
      location_id: parseInt(id)
    }
    return this.db.one(sql.add, values)
  }

  show(id) {
    return this.db.one(sql.show, {id: parseInt(id)})
  }

  edit(id, obj) {
    const values = {...obj, id: parseInt(id)}
    return this.db.one(sql.edit, values)
  }

  list(id) {
    return this.db.any(sql.list, {id: parseInt(id)})
  }
}

module.exports = Reviews
