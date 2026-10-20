const db = require('../db')
const middleware = require('../middleware')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

post(
  '/',
  middleware.authenticate(),
  middleware.recaptcha,
  async (req) => {
    if (req.user) {
      req.body.reporter_id = req.user.id
      if (!req.body.email || !req.body.name) {
        const user = await db.one(
          'SELECT name, email FROM users WHERE id=${id}', {id: req.user.id}
        )
        req.body.email = req.body.email || user.email
        req.body.name = req.body.name || user.name
      }
    }
    if (!req.body.email) {
      throw Error('An email is required')
    }
    if (req.body.problem_code === 5 && !req.body.comment) {
      throw Error('comment is required when problem_code = 5')
    }
    return db.reports.add(req.body)
  }
)

module.exports = router
