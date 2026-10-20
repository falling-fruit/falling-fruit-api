const {EARTH_RADIUS, EARTH_CIRCUMFERENCE, MAX_LATITUDE} = require('./constants')

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

// /**
//  * Transform point from Web Mercator to WGS84.
//  *
//  * @param {Point} point - Point (Web Mercator).
//  * @returns {Point} Point (WGS84).
//  */
// function mercator_to_wgs84({x, y}) {
//   return {
//     x: x * (360 / EARTH_CIRCUMFERENCE),
//     y: 90 - (Math.atan2(1, Math.exp(y / EARTH_RADIUS)) * 360 / Math.PI)
//   }
// }

module.exports = _
