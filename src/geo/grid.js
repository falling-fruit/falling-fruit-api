const {EARTH_CIRCUMFERENCE, MAX_GRID_ZOOM} = require('./constants')

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

// /**
//  * Grid cell indices to Web Mercator (SRID 900913).
//  *
//  * Returns the lower left corner of the cell.
//  */
// function gridcell_to_mercator({x, y, zoom}) {
//   const cell_size = EARTH_CIRCUMFERENCE / (2 ** zoom)
//   // Move origin to center
//   return {
//     x: x * cell_size - (EARTH_CIRCUMFERENCE / 2),
//     y: y * cell_size - (EARTH_CIRCUMFERENCE / 2)
//   }
// }

_.gridcell_to_geohash = function({x, y, zoom}) {
  // if (x < 0 || x > 2 ** zoom - 1 || y < 0 || y > 2 ** zoom - 1) {
  //   throw Error('Grid indices must be in the range [0, 2 ** zoom)')
  // }
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

// function geohash_to_gridcell(geohash) {
//   // Expand hash to binary
//   let xb = ''
//   let yb = ''
//   for (let i = 0; i < geohash.length; i += 2) {
//     xb += geohash[i]
//     yb += geohash[i + 1]
//   }
//   // Convert to integer
//   return {
//     x: parseInt(xb, 2),
//     y: parseInt(yb, 2),
//     zoom: geohash_to_zoom(geohash)
//   }
// }

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

module.exports = _
