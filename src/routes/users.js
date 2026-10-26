const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

get(
  '/:id',
  async (req) => {
    return await db.users.show_public(req.params.id)
  }
)

  return router
}
