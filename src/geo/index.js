const {MAX_GRID_ZOOM} = require('./constants')
const coordinates = require('./coordinates')
const projection = require('./projection')
const grid = require('./grid')
const clusters = require('./clusters')

const _ = {
  ...coordinates,
  ...projection,
  ...grid,
  ...clusters
}

_.MAX_GRID_ZOOM = MAX_GRID_ZOOM

module.exports = _
