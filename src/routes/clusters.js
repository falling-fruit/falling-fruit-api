const db = require('../db')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

get(
  '/',
  req => db.clusters.list(req.query)
)

module.exports = router
