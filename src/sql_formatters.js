const {MAX_GRID_ZOOM, wgs84_to_mercator} = require('./projection')

const _ = {}
_.wgs84_to_mercator = wgs84_to_mercator

_.muni_to_sql = function(value) {
  if (value == 'false') {
    return 'NOT muni'
  }
}

_.invasive_to_sql = function(value) {
  if (value == 'true') {
    return 'invasive'
  }
}

_.ids_to_sql = function(value) {
  // '1,2,3'
  if (value) {
    return `id IN (${value})`
  }
}

_.types_to_sql = function(value) {
  // '1,2,3'
  if (value) {
    return `type_id IN (${value})`
  }
}

_.types_array_to_sql = function(value) {
  // '1,2,3'
  if (value) {
    // Sorting shown to reduce db time 4x (?!). Requires intarray extension.
    return `type_ids && sort(ARRAY[${value}])`
  }
}

/**
 * Convert bounding box to SQL condition.
 *
 * @param {Point[]} bounds - Bounding box (WGS84).
 * @param {boolean} mercator - Whether to use filter on `location` (WGS84 geometry)
 * or `x` and `y` (cached mercator coordinates).
 * @returns {string} SQL condition.
 */
_.bounds_to_sql = function(
  bounds, { geography = null, epsg = 4326, mercator = false } = {}
) {
  var {x, y} = {x: 'lng', y: 'lat'}
  if (mercator) {
    var {x, y} = {x: 'x', y: 'y'}
    bounds = bounds.map(point => _.wgs84_to_mercator(point, clip = true))
  }
  if (geography) {
    return (
      `${geography} && ST_MakeEnvelope(` +
      `${bounds[0].x}, ${bounds[0].y}, ${bounds[1].x}, ${bounds[1].y}, ${epsg})`
    )
  }
  const operator = bounds[1].x > bounds[0].x ? 'AND' : 'OR'
  return (
    `(${x} > ${bounds[0].x} ${operator} ${x} < ${bounds[1].x}) AND ` +
    `(${y} > ${bounds[0].y} AND ${y} < ${bounds[1].y})`
  )
}

_.zoom_to_sql = function(value) {
  const zoom = parseInt(value)
  if (zoom < 0 || zoom > MAX_GRID_ZOOM) {
    throw Error(`Zoom not in interval [0, ${MAX_GRID_ZOOM}]`)
  }
  return `zoom = ${zoom}`
}

module.exports = _
