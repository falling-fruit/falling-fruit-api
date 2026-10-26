const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware }) {
  const { router, get, post, put, drop } = makeRouter()

get(
  '/:id',
  async (req) => {
    const review = await db.reviews.show(req.params.id)
    review.photos = await db.photos.list(req.params.id)
    return review
  }
)
put(
  '/:id',
  middleware.authenticate('user'),
  middleware.test_review(),
  async (req, res) => {
    const original = await db.reviews.show(req.params.id)
    // Restrict to linked user
    if (req.user.id != original.user_id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const photos = await db.photos.test_unlinked(req.body.photo_ids, original.id)
    const review = await db.reviews.edit(req.params.id, req.body)
    await db.photos.link(req.body.photo_ids, review.id)
    review.photos = photos
    return review
  }
)
drop(
  '/:id',
  middleware.authenticate('user'),
  async (req, res) => {
    const original = await db.reviews.show(req.params.id)
    // Restrict to linked user
    if (req.user.id != original.user_id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    await db.reviews.delete(req.params.id)
    return void res.status(204).send()
  }
)

  return router
}
