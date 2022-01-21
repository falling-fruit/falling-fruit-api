const sql = require('../sql').reviews
const Changes = require('./changes')

class Reviews {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    this.changes = new Changes(db, pgp)
  }

  async add(id, obj) {
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
    const review = await this.db.one(sql.add, values)
    await this.changes.add({description: 'visited', review: review})
    return review
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

  delete(id) {
    return this.db.none('DELETE FROM observations WHERE id = ${id}', {id: parseInt(id)})
  }
}

module.exports = Reviews
