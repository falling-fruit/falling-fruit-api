const db = require('../db')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

get(
  '/:id',
  async (req) => {
    return await db.users.show_public(req.params.id)
  }
)

module.exports = router
