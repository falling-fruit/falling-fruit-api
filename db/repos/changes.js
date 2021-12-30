const sql = require('../sql').changes
const _ = require('../../helpers')

class Changes {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  list({limit = '100', offset = '0', user_id = null, range = 'false'}) {
    let user_filter
    if (user_id) {
      if (range === 'true') {
        user_filter = `ST_INTERSECTS(l.location, (SELECT range FROM users u2 WHERE u2.id = ${parseInt(user_id)}))`
      } else {
        user_filter = `c.user_id = ${parseInt(user_id)}`
      }
    }
    const filters = ['NOT l.hidden', user_filter]
    const values = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      where: filters.filter(Boolean).join(' AND ')
    }
    return this.db.any(sql.list, values)
  }

  add({description, location = null, review = null, user_id = null}) {
    const is_review = description === 'visited'
    const values = {
      description: description,
      location: location,
      location_id: is_review ? review.location_id : location.id,
      review: review,
      review_id: review ? review.id : null,
      // User ID override for location edits
      user_id: user_id || (is_review ? review.user_id : location.user_id)
    }
    return this.db.none(sql.add, values)
  }
}

module.exports = Changes
