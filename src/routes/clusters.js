const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

get(
  '/',
  req => db.clusters.list(req.query)
)

  return router
}
