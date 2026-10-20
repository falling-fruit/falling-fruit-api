function is_date_in_future(datestamp) {
  // Compare date to current date + 1 day (accounting for timezones)
  const date = new Date(datestamp)
  date.setUTCHours(0, 0, 0, 0)
  const today = new Date()
  today.setUTCHours(0,0,0,0)
  today.setDate(today.getDate() + 1)
  return date > today
}

/**
 * Check if value should be considered null (empty).
 *
 * @param {*} value - Value to check.
 * @param {*} zero - Whether to consider zero as null.
 * @returns {boolean} Whether value is null.
 * @example
 * is_null(null)  // true
 * is_null(undefined)  // true
 * is_null('')  // true
 * is_null('a')  // false
 * is_null(0)  // false
 * is_null(0, true)  // true
 * is_null(1)  // false
 * is_null([])  // true
 * is_null([0])  // false
 * is_null({})  // true
 * is_null({a: 0})  // false
 */
function is_null(value, zero = false) {
  if (Array.isArray(value)) {
    return value.length == 0
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    return Object.keys(value).length == 0
  } else {
    const nulls = ['', null, undefined]
    if (zero) {
      nulls.push(0)
    }
    return nulls.includes(value)
  }
}

function test_review(...path) {
  return function(req, res, next) {
    const review = path.reduce((prev, curr) => prev && prev[curr], req.body)
    if (!review) {
      return void next()
    }
    // Forbid observed_on date in the future (accounting for timezones)
    if (review.observed_on && is_date_in_future(review.observed_on)) {
      return void res.status(400).json({error: 'observed_on cannot be in the future'})
    }
    // Require observed_on date if fruiting is not null
    if (!is_null(review.fruiting) && !review.observed_on) {
      return void res.status(400).json(
        {error: 'observed_on is required when fruiting is provided'}
      )
    }
    // Require content
    const required = ['photo_ids', 'comment', 'fruiting', 'quality_rating', 'yield_rating']
    if (required.every(key => is_null(review[key]))) {
      return void res.status(400).json(
        {error: `One of {${required.join(', ')}} is required`}
      )
    }
    return void next()
  }
}

module.exports = test_review
