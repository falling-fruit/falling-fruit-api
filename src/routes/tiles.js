const db = require('../db')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

get(
  '/:z/:x/:y.pbf',
  async (req, res) => {
    const mvt = await db.tiles.show(req.params)
    return void res.status(200).end(mvt)
  }
)

module.exports = router
