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
 * Convert bounding box to a PostGIS SQL condition on a geometry/geography column.
 *
 * @param {Point[]} bounds - Bounding box (WGS84).
 * @param {string} geography - Name of the WGS84 geometry/geography column.
 * @param {number} [epsg=4326] - SRID of the envelope.
 * @returns {string} SQL condition.
 */
_.bounds_to_geography_sql = function(bounds, geography, epsg = 4326) {
  return (
    `${geography} && ST_MakeEnvelope(` +
    `${bounds[0].x}, ${bounds[0].y}, ${bounds[1].x}, ${bounds[1].y}, ${epsg})`
  )
}

/**
 * Convert bounding box to a SQL condition on `lng` and `lat` columns (WGS84).
 *
 * @param {Point[]} bounds - Bounding box (WGS84).
 * @returns {string} SQL condition.
 */
_.bounds_to_lnglat_sql = function(bounds) {
  const operator = bounds[1].x > bounds[0].x ? 'AND' : 'OR'
  return (
    `(lng > ${bounds[0].x} ${operator} lng < ${bounds[1].x}) AND ` +
    `(lat > ${bounds[0].y} AND lat < ${bounds[1].y})`
  )
}

/**
 * Convert bounding box to a SQL condition on cached mercator `x` and `y` columns.
 *
 * @param {Point[]} bounds - Bounding box (WGS84), projected to Web Mercator here.
 * @returns {string} SQL condition.
 */
_.bounds_to_mercator_sql = function(bounds) {
  bounds = bounds.map(point => _.wgs84_to_mercator(point, true))
  const operator = bounds[1].x > bounds[0].x ? 'AND' : 'OR'
  return (
    `(x > ${bounds[0].x} ${operator} x < ${bounds[1].x}) AND ` +
    `(y > ${bounds[0].y} AND y < ${bounds[1].y})`
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
