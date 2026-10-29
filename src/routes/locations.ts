import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import { delimitedQuery, intQuery, numberArrayQuery, boolQuery } from '../schemas/query'
import createPhotos from '../photos'
import {
  Location,
  ListLocation,
  EditLocation,
  AddLocation,
  LocationChange,
  LocationList,
  EditLocationList,
  Review,
  EditReview,
} from '../schemas/schemas'
import {
  boundsParam,
  muniParam,
  typesParam,
  invasiveParam,
  offsetParam,
  locationIdParam,
  locationListIdParam,
  recaptchaParam,
} from '../schemas/parameters'

const set_equal = function <T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((value) => b.includes(value))
}

const embedLocationsParam = delimitedQuery(
  z.array(z.enum(['locations'])).optional(),
  ',',
).openapi({
  param: { name: 'embed', in: 'query', explode: false },
  description:
    'Additional information to include.\n- locations: List locations.\n',
})

export default function ({ db, middleware, auth, photos: photosService }: Services) {
  const { router, get, post, put, drop } = makeRouter()

  // Routes: Location lists
  post(
    {
      path: '/locations/lists',
      summary: 'Create a new Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: { body: { schema: EditLocationList, required: true } },
      responses: {
        '200': { description: 'Success', schema: LocationList },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      if (!req.body.name) {
        return void res.status(400).json({ error: 'Name is required' })
      }
      return await db.locationLists.addList(req.body, user)
    },
  )

  get(
    {
      path: '/locations/lists',
      summary: "Fetch User's Location Lists.",
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: { query: z.object({ embed: embedLocationsParam }) },
      responses: {
        '200': { description: 'Success', schema: z.array(LocationList) },
      },
    },
    auth.required_role('user'),
    async (req, user) => {
      if (req.query.embed?.includes('locations')) {
        return await db.locationLists.listUserListsWithLocations(user.id)
      }
      return await db.locationLists.listUserLists(user.id)
    },
  )

  get(
    {
      path: '/locations/lists/:list_id',
      summary: 'Get a Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: {
        params: z.object({ list_id: locationListIdParam }),
        query: z.object({ embed: embedLocationsParam }),
      },
      responses: {
        '200': { description: 'Success', schema: LocationList },
      },
    },
    auth.required_role('user'),
    async (req, user) => {
      if (req.query.embed?.includes('locations')) {
        return await db.locationLists.showListWithLocations(req.params.list_id)
      }
      return await db.locationLists.showList(req.params.list_id)
    },
  )

  put(
    {
      path: '/locations/lists/:list_id',
      summary: 'Edit a Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: {
        params: z.object({ list_id: locationListIdParam }),
        body: { schema: EditLocationList, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: LocationList },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const list = await db.locationLists.showList(req.params.list_id)
      if (list.user_id != user.id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      if (!req.body.name) {
        return void res.status(400).json({ error: 'Name is required' })
      }
      return await db.locationLists.editList(req.params.list_id, req.body)
    },
  )

  drop(
    {
      path: '/locations/lists/:list_id',
      summary: 'Delete a Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: { params: z.object({ list_id: locationListIdParam }) },
      responses: {
        '200': { description: 'Success' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const list = await db.locationLists.showList(req.params.list_id)
      if (list.user_id != user.id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      await db.locationLists.deleteList(req.params.list_id)
      return void res.status(204).send()
    },
  )

  post(
    {
      path: '/locations/:id/lists/:list_id',
      summary: 'Add a Location to a Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: {
        params: z.object({
          id: locationIdParam,
          list_id: locationListIdParam,
        }),
      },
      responses: {
        '204': { description: 'Success' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const list = await db.locationLists.showList(req.params.list_id)
      if (list.user_id != user.id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      await db.locationLists.addLocationToList(
        req.params.id,
        req.params.list_id,
      )
      return void res.status(204).send()
    },
  )

  drop(
    {
      path: '/locations/:id/lists/:list_id',
      summary: 'Remove a Location from a Location List.',
      tags: ['Location lists'],
      security: [{ key: [], token: [] }],
      request: {
        params: z.object({
          id: locationIdParam,
          list_id: locationListIdParam,
        }),
      },
      responses: {
        '204': { description: 'Success' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const list = await db.locationLists.showList(req.params.list_id)
      if (list.user_id != user.id) {
        return void res
          .status(403)
          .json({ error: 'Insufficient permissions' })
      }
      await db.locationLists.dropLocationFromList(
        req.params.id,
        req.params.list_id,
      )
      return void res.status(204).send()
    },
  )

  // Routes: Locations
  get(
    {
      path: '/locations',
      summary: 'Fetch Location summaries.',
      tags: ['Locations'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        query: z.object({
          ids: numberArrayQuery(
            z.array(z.number().int().min(0)).optional(),
          ).openapi({
            param: { name: 'ids', in: 'query', explode: false },
            description:
              'Location IDs. If provided, other filters (`bounds`, `muni`, `types`, `invasives`) are ignored and locations are returned whether or not they are hidden.',
            uniqueItems: true,
            default: null,
          }),
          bounds: delimitedQuery(
            z
              .array(z.string().regex(/^(-?\d+\.?(\d+)?),(-?\d+\.?(\d+)?)$/))
              .min(2)
              .max(2)
              .optional(),
            '|',
          ).openapi({
            param: {
              name: 'bounds',
              in: 'query',
              explode: false,
              style: 'pipeDelimited',
            },
            description:
              'The southwest and northeast corners of the bounding box in WGS84 decimal degrees, in the format `swlat,swlng|nelat,nelng`. Latitude must be in the interval [-85.0511, 85.0511] and longitude must be in the interval [-180, 180]. Required if `center` is not provided.',
            example: ['-5,-180', '5,180'],
          }),
          center: numberArrayQuery(
            z.array(z.number().min(-180).max(180)).min(2).max(2).optional(),
          ).openapi({
            param: { name: 'center', in: 'query', explode: false },
            description:
              'Center `latitude,longitude` in WGS84 decimal degrees. If provided, Locations are returned in order of increasing distance and the distance to each Location is returned. Longitude must be in the interval [-180, 180] and latitude in the interval [-90, 90].',
            example: [1.359, 103.807],
          }),
          muni: muniParam,
          types: typesParam,
          invasive: invasiveParam,
          limit: intQuery(z.number().int().min(0).default(1000)).openapi({
            param: { name: 'limit', in: 'query' },
            description: 'Maximum number of Locations to return.',
          }),
          offset: offsetParam,
          photo: boolQuery(z.boolean().default(false)).openapi({
            param: { name: 'photo', in: 'query' },
            description:
              'Whether to include the path to a review photo thumbnail, if available.',
          }),
          count: boolQuery(z.boolean().default(false)).openapi({
            param: { name: 'count', in: 'query' },
            description:
              'Whether to include the total number of locations matching the query in the `x-total-count` header.',
          }),
          locale: z.string().optional().openapi({
            param: { name: 'locale', in: 'query' },
            description:
              'Whether (and in which language) to include a name for each Location Type, as an ISO 639-1 language code or `scientific` for the scientific (latin) name (applicable to lifeforms only). To guarantee that the name is not null, the first non-null name is provided from the requested locale, `en` (English), or `scientific`. Ignored if `center` is provided.',
            deprecated: true,
          }),
        }),
      },
      responses: {
        '200': {
          description: 'Success',
          schema: z.array(ListLocation),
          headers: {
            'x-total-count': {
              schema: { type: 'integer' },
              description:
                'Total number of locations meeting the query conditions (if `count=true`).',
            },
          },
        },
      },
    },
    auth.optional,
    async (req, user, res) => {
      const locations = await db.locations.list(req.query, user)
      if (req.query.count) {
        const limit = req.query.limit ?? 1000
        let count = locations.length
        if (locations.length === limit) {
          count = (await db.locations.count(req.query)).count
        }
        res.set({ 'x-total-count': count })
      }
      return locations
    },
  )

  post(
    {
      path: '/locations',
      summary: 'Create a Location.',
      description:
        'A `review` can be included, in which case the result includes the `reviews` property.',
      tags: ['Locations'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        headers: [recaptchaParam],
        body: { schema: AddLocation, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Location },
      },
    },
    auth.optional,
    middleware.recaptcha,
    middleware.test_review((body: AddLocation) => body.review),
    async (req, user) => {
      // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
      const user_id = user ? user.id : null
      const review_body = req.body.review
      const photos = review_body
        ? await db.photos.test_unlinked(review_body.photo_ids)
        : undefined
      const location = await db.locations.add({ ...req.body, user_id })
      if (review_body) {
        const review = await db.reviews.add(location.id, {
          ...review_body,
          user_id,
        })
        await db.photos.link(review_body.photo_ids, review.id)
        await createPhotos.sync_legacy_first_photo(
          db.photos,
          photosService,
          review_body.photo_ids,
          review.id,
        )
        review.photos = photos!
        location.reviews = [review]
      }
      await db.clusters.increment(location)
      return location
    },
  )

  get(
    {
      path: '/locations/count',
      summary: 'Count Locations.',
      tags: ['Locations'],
      security: [{ key: [] }],
      request: {
        query: z.object({
          bounds: boundsParam,
          muni: muniParam,
          types: typesParam,
          invasive: invasiveParam,
        }),
      },
      responses: {
        '200': {
          description: 'Success',
          schema: z.object({
            count: z.number().int().min(0).openapi({ example: 25 }),
          }),
        },
      },
    },
    auth.none,
    (req) => db.locations.count(req.query),
  )

  get(
    {
      path: '/locations/changes',
      summary: 'Fetch Location changes (activity).',
      description:
        "A change event is recorded when a location is added (`'added'`), a location is edited (`'edited'`), or a location is reviewed (`'visited'`). Results are sorted in reverse chronological order (most recent first).\n\nFiltering by user `range` is restricted to the user.\n",
      tags: ['Locations'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        query: z.object({
          earliest: z
            .string()
            .datetime({ offset: true })
            .optional()
            .openapi({
              param: { name: 'earliest', in: 'query' },
              description: 'Earliest UTC datetime of change (inclusive).',
              default: null,
            }),
          latest: z
            .string()
            .datetime({ offset: true })
            .optional()
            .openapi({
              param: { name: 'latest', in: 'query' },
              description: 'Latest UTC datetime of change (exclusive).',
              default: null,
            }),
          user_id: intQuery(z.number().int().min(1).optional()).openapi({
            param: { name: 'user_id', in: 'query' },
            description: 'User ID of changes to return.',
            default: null,
          }),
          range: boolQuery(z.boolean().default(false)).openapi({
            param: { name: 'range', in: 'query' },
            description:
              'Whether to filter changes within the foraging range of the user with `user_id`, rather than by the user.',
          }),
        }),
      },
      responses: {
        '200': { description: 'Success', schema: z.array(LocationChange) },
      },
    },
    auth.optional,
    async (req, user, res) => {
      if (req.query.user_id && (!user || user.id != req.query.user_id)) {
        if (req.query.range) {
          return void res.status(403).json({
            error: 'Only a user can filter by their own foraging range',
          })
        }
        await db.users.show(req.query.user_id)
      }
      return db.changes.list(req.query)
    },
  )

  get(
    {
      path: '/locations/:id',
      summary: 'Fetch a Location.',
      tags: ['Locations'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        params: z.object({ id: locationIdParam }),
        query: z.object({
          embed: delimitedQuery(
            z.array(z.enum(['reviews', 'import'])).optional(),
            ',',
          ).openapi({
            param: { name: 'embed', in: 'query', explode: false },
            description:
              'Additional information to include.\n- reviews: Location reviews.\n- import: Imported dataset.\n',
          }),
        }),
      },
      responses: {
        '200': { description: 'Success', schema: Location },
      },
    },
    auth.optional,
    async (req, user) => {
      const location = await db.locations.show(req.params.id, user)
      const embedded = req.query.embed
      if (embedded) {
        if (embedded.includes('reviews')) {
          location.reviews = await db.reviews.list(req.params.id)
        }
        if (embedded.includes('import') && location.import_id) {
          location.import = await db.imports.show(location.import_id)
          delete location.import_id
        }
      }
      return location
    },
  )

  put(
    {
      path: '/locations/:id',
      summary: 'Edit a Location.',
      tags: ['Locations'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        params: z.object({ id: locationIdParam }),
        headers: [recaptchaParam],
        body: { schema: EditLocation, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Location },
      },
    },
    auth.optional,
    middleware.recaptcha,
    async (req, user) => {
      const old = await db.locations.show(req.params.id, null)
      const updated = await db.locations.edit(
        req.params.id,
        req.body,
        user,
      )
      if (
        updated.lat != old.lat ||
        updated.lng != old.lng ||
        updated.muni != old.muni ||
        !set_equal(updated.type_ids, old.type_ids)
      ) {
        await db.clusters.decrement(old)
        await db.clusters.increment(updated)
      }
      return updated
    },
  )

  drop(
    {
      path: '/locations/:id',
      summary: 'Delete a Location.',
      description:
        'Restricted to the same user that created the location. Deletion is only permitted if the location is not associated with any reviews other than their own and no other (non-admin) user edited the location in the meantime.',
      tags: ['Locations'],
      security: [{ key: [], token: [] }],
      request: { params: z.object({ id: locationIdParam }) },
      responses: {
        '204': { description: 'Success (no content)' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      const original = await db.locations.show(req.params.id, null)
      if (user.id != original.user_id) {
        return void res
          .status(403)
          .json({ error: 'Location was created by another user' })
      }
      const reviews = await db.reviews.list(req.params.id)
      for (const review of reviews) {
        if (review.user_id != user.id) {
          return void res
            .status(403)
            .json({ error: 'Location contains reviews from other users' })
        }
      }
      const changes = await db.changes.list_location_edits(req.params.id)
      for (const change of changes) {
        if (change.user_id != user.id) {
          let editor
          if (change.user_id) {
            editor = await db.users.show(change.user_id)
          }
          if (!editor || !editor.roles.includes('admin')) {
            return void res
              .status(403)
              .json({ error: 'Location was edited by another user' })
          }
        }
      }
      await db.locations.delete(req.params.id)
      return void res.status(204).send()
    },
  )

  // Routes: Reviews
  get(
    {
      path: '/locations/:id/reviews',
      summary: "Fetch a Location's Reviews.",
      tags: ['Reviews'],
      security: [{ key: [] }],
      request: { params: z.object({ id: locationIdParam }) },
      responses: {
        '200': { description: 'Success', schema: z.array(Review) },
      },
    },
    auth.none,
    (req) => db.reviews.list(req.params.id),
  )

  post(
    {
      path: '/locations/:id/reviews',
      summary: 'Review a Location.',
      description:
        'If `fruiting` is provided, `observed_on` is required. One of `comment`, `fruiting`, `quality_rating`, `yield_rating`, or `photo_ids` is required.',
      tags: ['Reviews'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        params: z.object({ id: locationIdParam }),
        headers: [recaptchaParam],
        body: { schema: EditReview, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Review },
        '400': {
          description: 'Bad request',
          schema: z.object({
            error: z.string().openapi({
              description: 'Error message',
              example: 'observed_on is required if fruiting is provided',
            }),
          }),
        },
      },
    },
    auth.optional,
    middleware.recaptcha,
    middleware.test_review((body: EditReview) => body),
    async (req, user) => {
      // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
      const photos = await db.photos.test_unlinked(req.body.photo_ids)
      const review = await db.reviews.add(req.params.id, {
        ...req.body,
        user_id: user ? user.id : null,
      })
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

  return router
}
