import makeRouter from './makeRouter'
import { z } from '../schemas/registry'
import { Review, EditReview } from '../schemas/schemas'
import { reviewIdParam } from '../schemas/parameters'
import createPhotos from '../photos'
import type { Services } from './services'

export default function ({ db, middleware, auth, photos: photosService }: Services) {
  const { router, get, put, drop } = makeRouter()

  get(
    {
      path: '/reviews/:id',
      summary: 'Fetch a Review.',
      tags: ['Reviews'],
      security: [{ key: [] }],
      request: { params: z.object({ id: reviewIdParam }) },
      responses: {
        '200': { description: 'Success', schema: Review },
      },
    },
    auth.none,
    async (req) => {
      const review = await db.reviews.show(req.params.id)
      review.photos = await db.photos.list(req.params.id)
      return review
    },
  )

  put(
    {
      path: '/reviews/:id',
      summary: 'Edit a Review (author only).',
      description: 'If `fruiting` is provided, `observed_on` is required.',
      tags: ['Reviews'],
      security: [{ key: [], token: [] }],
      request: {
        params: z.object({ id: reviewIdParam }),
        body: { schema: EditReview, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Review },
      },
    },
    auth.required_role('user'),
    middleware.test_review((body: EditReview) => body),
    async (req, user, res) => {
      const original = await db.reviews.show(req.params.id)
      if (user.id != original.user_id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
      const photos = await db.photos.test_unlinked(
        req.body.photo_ids,
        original.id,
      )
      const review = await db.reviews.edit(req.params.id, req.body)
      await db.photos.link(req.body.photo_ids, review.id)
      await createPhotos.sync_legacy_first_photo(
        db.photos,
        photosService,
        req.body.photo_ids,
        review.id,
      )
      review.photos = photos
      return review
    },
  )

  drop(
    {
      path: '/reviews/:id',
      summary: 'Delete a Review.',
      description: 'Restricted to the same user that created the review.',
      tags: ['Reviews'],
      security: [{ key: [], token: [] }],
      request: { params: z.object({ id: reviewIdParam }) },
      responses: {
        '204': { description: 'Success (no content)' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const original = await db.reviews.show(req.params.id)
      if (user.id != original.user_id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      await db.reviews.delete(req.params.id)
      return void res.status(204).send()
    },
  )

  return router
}
