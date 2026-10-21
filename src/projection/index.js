const {
  EARTH_RADIUS, EARTH_CIRCUMFERENCE, MAX_LATITUDE, MAX_GRID_ZOOM
} = require('./constants')

const _ = {}

/**
 * Transform point from WGS84 to Web Mercator.
 *
 * @param {Point} point - Point (WGS84) with latitude in interval [-85.0511, 85.0511].
 * @param {Boolean} clip - Whether to clip out of bound latitude to interval.
 * @returns {Point} Point (Web Mercator).
 */
_.wgs84_to_mercator = function({x, y}, clip = false) {
  if (clip) {
    y = Math.sign(y) * Math.min(Math.abs(y), MAX_LATITUDE)
  }
  if (Math.abs(y) > MAX_LATITUDE) {
    throw Error(`Latitude not in the interval [-${MAX_LATITUDE}, ${MAX_LATITUDE}]`)
  }
  return {
    x: (x / 360) * EARTH_CIRCUMFERENCE,
    y: Math.log(Math.tan((y + 90) * (Math.PI / 360))) * EARTH_RADIUS
  }
}

_.EARTH_RADIUS = EARTH_RADIUS
_.EARTH_CIRCUMFERENCE = EARTH_CIRCUMFERENCE
_.MAX_LATITUDE = MAX_LATITUDE
_.MAX_GRID_ZOOM = MAX_GRID_ZOOM

module.exports = _
