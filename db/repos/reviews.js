const sql = require('../sql').reviews
const Changes = require('./changes')
const _ = require('../../helpers')

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
      ...obj,
      location_id: parseInt(id)
    }
    // Forbid observed_on date in the future (accounting for timezones)
    if (values.observed_on && _.is_date_in_future(values.observed_on)) {
      throw Error('observed_on cannot be in the future')
    }
    // Require observed_on date if fruiting is not null
    if (!_.is_null(values.fruiting) && !values.observed_on) {
      throw Error('observed_on is required if fruiting is not null')
    }
    // Require at least comment, fruiting, quality_rating, or yield_rating
    const required = ['comment', 'fruiting', 'quality_rating', 'yield_rating']
    if (required.every(key => _.is_null(values[key]))) {
      throw Error(`One of {${required.join(', ')}} is required`)
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
