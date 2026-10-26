const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /reviews/{id}:
 *   get:
 *     summary: Fetch a Review.
 *     tags:
 *       - Reviews
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/review_id'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 */
get(
  '/reviews/:id',
  async (req) => {
    const review = await db.reviews.show(req.params.id)
    review.photos = await db.photos.list(req.params.id)
    return review
  }
)
/**
 * @openapi
 * /reviews/{id}:
 *   put:
 *     tags:
 *       - Reviews
 *     summary: Edit a Review (author only).
 *     description: If `fruiting` is provided, `observed_on` is required.
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/review_id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditReview'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 */
put(
  '/reviews/:id',
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
/**
 * @openapi
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a Review.
 *     description: Restricted to the same user that created the review.
 *     tags:
 *       - Reviews
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/review_id'
 *     responses:
 *       '204':
 *         description: Success (no content)
 */
drop(
  '/reviews/:id',
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
