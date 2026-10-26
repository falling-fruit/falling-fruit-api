const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

get('/', () => db.imports.list())
get('/:id', req => db.imports.show(req.params.id))

  return router
}
