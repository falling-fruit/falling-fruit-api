const _ = {}

/**
 * Convert a database row into the API object.
 *
 * @param {object} location - Raw location row.
 * @returns {object} API-shaped location.
 */
_.fromRow = function(location) {
  // TEMP: Replace no_season=true with season=[0, 11]
  if (location.no_season) {
    location.season_start = 0
    location.season_stop = 11
  }
  delete location.no_season
  return location
}

/**
 * Convert an API object into a database row, applying column defaults.
 *
 * @param {object} obj - API-shaped location (from a request body).
 * @returns {object} Location row, ready to insert.
 */
_.toRow = function(obj) {
  return {
    season_start: null,
    season_stop: null,
    access: null,
    description: null,
    unverified: false,
    user_id: null,
    ...obj
  }
}

module.exports = _
