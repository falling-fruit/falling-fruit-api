const {MAX_GRID_ZOOM} = require('./constants')
const projection = require('./projection')
const grid = require('./grid')
const clusters = require('./clusters')

const _ = {
  ...projection,
  ...grid,
  ...clusters
}

_.MAX_GRID_ZOOM = MAX_GRID_ZOOM

module.exports = _
