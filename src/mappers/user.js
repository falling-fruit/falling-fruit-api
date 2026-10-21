const _ = {}

/**
 * Convert a database row into the API object.
 *
 * @param {object} user - Raw user row (with `range` as a GeoJSON string).
 * @returns {object} API-shaped user.
 */
_.fromRow = function(user) {
  if (user.range) {
    user.range = JSON.parse(user.range)
  }
  return user
}

/**
 * Convert a request body into a database row, applying column defaults.
 *
 * @param {object} body - Request body.
 * @returns {object} User row (minus derived fields like the hashed password).
 */
_.toRow = function(body) {
  return {
    name: null,
    bio: null,
    range: null,
    announcements_email: true,
    ...body
  }
}

module.exports = _
