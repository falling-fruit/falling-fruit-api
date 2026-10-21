// Clustering: Mercator-only spatial indexing and centroid math.
//
// By contract, every function here takes Web Mercator meters (never WGS84
// degrees). Callers must project with src/projection first. Outputs are grid
// cells, geohashes, and cluster centroids in Mercator meters.

const { EARTH_CIRCUMFERENCE, MAX_GRID_ZOOM } = require('../projection/constants')

const _ = {}

/**
 * Web Mercator (SRID 900913) to grid cell indices.
 */
_.mercator_to_gridcell = function({x, y}, zoom = MAX_GRID_ZOOM) {
  const cell_size = EARTH_CIRCUMFERENCE / (2 ** zoom)
  // Move origin to bottom left corner
  // Convert to grid cell number
  return {
    x: Math.floor((x + EARTH_CIRCUMFERENCE / 2) / cell_size),
    y: Math.floor((y + EARTH_CIRCUMFERENCE / 2) / cell_size),
    zoom: zoom
  }
}

_.gridcell_to_geohash = function({x, y, zoom}) {
  // Convert to binary
  const xb = x.toString(2).padStart(zoom + 1, '0')
  const yb = y.toString(2).padStart(zoom + 1, '0')
  // Build hash
  let geohash = ''
  for (let i = 0; i < xb.length; i++) {
    geohash += xb[i] + yb[i]
  }
  return geohash
}

_.expand_geohash = function(geohash) {
  const geohashes = []
  for (let i = geohash.length; i > 0; i -= 2) {
    geohashes.push(geohash.substring(0, i))
  }
  return geohashes
}

_.geohash_to_zoom = function(geohash) {
  return (geohash.length / 2) - 1
}

function weighted_mean(values, weights) {
  const [value, weight] = values
    .map((value, i) => [value, weights[i]])
    .reduce(([value_sum, weight_sum], [value, weight]) => {
      return [value_sum + value * weight, weight_sum + weight]
    }, [0, 0])
  return value / weight
}

_.move_cluster = function({cx, cy}, n, {x, y}, add) {
  return {
    x: weighted_mean([cx, x], [n, add]),
    y: weighted_mean([cy, y], [n, add])
  }
}

module.exports = _
