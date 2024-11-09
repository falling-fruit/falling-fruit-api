const sql = require('../sql').changes
const e = require('express')
const _ = require('../../helpers')

class Changes {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  list({earliest = null, latest = null, user_id = null, range = 'false'}) {
    earliest = _.parse_datetime(earliest)
    latest = _.parse_datetime(latest)
    const filters = ['NOT l.hidden']
    if (earliest) {
      filters.push(`c.created_at >= '${earliest}'::timestamptz`)
    }
    if (latest) {
      filters.push(`c.created_at < '${latest}'::timestamptz`)
    }
    if (user_id) {
      let user_filter
      if (range === 'true') {
        user_filter = `ST_INTERSECTS(l.location, (SELECT range FROM users u2 WHERE u2.id = ${parseInt(user_id)}))`
      } else {
        user_filter = `c.user_id = ${parseInt(user_id)}`
      }
      filters.push(user_filter)
    }
    const values = { where: filters.join(' AND ') }
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

  delete_review(id) {
    return this.db.none('DELETE FROM changes WHERE observation_id = ${id}', {id: parseInt(id)})
  }
}

module.exports = Changes
