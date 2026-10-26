// Parser for a bounding-box request parameter (WGS84 'swlat,swlng|nelat,nelng').

const { parse_point } = require('./point')

/**
 * Parse bounding box coordinates.
 *
 * @param {string} value - Bounds in the format 'swlat,swlng|nelat,nelng'
 * (WGS84 decimal degrees).
 * @returns {Point[]} Parsed points in WGS84 decimal degrees.
 */
function parse_bounds(value) {
  const points = value.split('|').map(x => parse_point(x))
  if (points.length != 2) {
    throw Error('Bounds not in the format {lat},{lng}|{lat},{lng}')
  }
  if (points[0].y > points[1].y) {
    throw Error('Bounds not in the format {swlat},{swlng}|{nelat},{nelng}')
  }
  return points
}

module.exports = { parse_bounds }
