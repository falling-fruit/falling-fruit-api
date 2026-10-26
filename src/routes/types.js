const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware }) {
  const { router, get, post, put, drop } = makeRouter()

get(
  '/',
  () => db.types.list()
)
post(
  '/',
  middleware.authenticate(),
  middleware.recaptcha,
  (req, res) => {
    if (req.body.pending === false && (!req.user || !req.user.roles.includes('admin'))) {
      return void res.status(403).json(
        {error: 'Only admins can approve a type (pending: false)'}
      )
    }
    const user_id = req.user ? req.user.id : null
    return db.types.add({...req.body, user_id: user_id})
  }
)
get(
  '/counts',
  req => db.types.count(req.query)
)
get(
  '/:id',
  req => db.types.show(req.params.id)
)

  return router
}
