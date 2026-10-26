const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware }) {
  const { router, get, post, put, drop } = makeRouter()

const set_equal = function(a, b) {
  return a.length === b.length && a.every(value => b.includes(value))
}

// Routes: Location lists
/**
 * @openapi
 * /locations/lists:
 *   post:
 *     summary: Create a new Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditLocationList'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationList'
 */
post(
  '/locations/lists',
  middleware.authenticate('user'),
  async (req, res) => {
    // Require name
    if (!req.body.name) {
      return void res.status(400).json({error: 'Name is required'})
    }
    return await db.locationLists.addList(req.body, req.user)
  }
)
/**
 * @openapi
 * /locations/lists:
 *   get:
 *     summary: Fetch User's Location Lists.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - name: embed
 *         description: |
 *           Additional information to include.
 *           - locations: List locations.
 *         in: query
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [locations]
 *           default: null
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LocationList'
 */
get(
  '/locations/lists',
  middleware.authenticate('user'),
  async (req) => {
    if (req.query.embed === 'locations') {
      return await db.locationLists.listUserListsWithLocations(req.user.id)
    }
    return await db.locationLists.listUserLists(req.user.id)
  }
)
/**
 * @openapi
 * /locations/lists/{list_id}:
 *   get:
 *     summary: Get a Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_list_id'
 *       - name: embed
 *         description: |
 *           Additional information to include.
 *           - locations: List locations.
 *         in: query
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [locations]
 *           default: null
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationList'
 */
get(
  '/locations/lists/:id',
  middleware.authenticate('user'),
  async (req) => {
    if (req.query.embed === 'locations') {
      return await db.locationLists.listUserListsWithLocations(req.user.id)
    }
    return await db.locationLists.listUserLists(req.user.id)
  }
)
/**
 * @openapi
 * /locations/lists/{list_id}:
 *   put:
 *     summary: Edit a Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_list_id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditLocationList'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationList'
 */
put(
  '/locations/lists/:id',
  middleware.authenticate('user'),
  async (req, res) => {
    // Restrict to linked user
    const list = await db.locationLists.showList(req.params.id)
    if (list.user_id != req.user.id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    // Require name
    if (!req.body.name) {
      return void res.status(400).json({error: 'Name is required'})
    }
    return await db.locationLists.editList(req.params.id, req.body)
  }
)
/**
 * @openapi
 * /locations/lists/{list_id}:
 *   delete:
 *     summary: Delete a Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_list_id'
 *     responses:
 *       '200':
 *         description: Success
 */
drop(
  '/locations/lists/:id',
  middleware.authenticate('user'),
  async (req, res) => {
    // Restrict to linked user
    const list = await db.locationLists.showList(req.params.id)
    if (list.user_id != req.user.id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    await db.locationLists.deleteList(req.params.id)
    return void res.status(204).send()
  }
)
/**
 * @openapi
 * /locations/{id}/lists/{list_id}:
 *   post:
 *     summary: Add a Location to a Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *       - $ref: '#/components/parameters/location_list_id'
 *     responses:
 *       '204':
 *         description: Success
 */
post(
  '/locations/:id/lists/:list_id',
  middleware.authenticate('user'),
  async (req, res) => {
    // Restrict to linked user
    const list = await db.locationLists.showList(req.params.list_id)
    if (list.user_id != req.user.id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    await db.locationLists.addLocationToList(req.params.id, req.params.list_id)
    return void res.status(204).send()
  }
)
/**
 * @openapi
 * /locations/{id}/lists/{list_id}:
 *   delete:
 *     summary: Remove a Location from a Location List.
 *     tags:
 *       - Location lists
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *       - $ref: '#/components/parameters/location_list_id'
 *     responses:
 *       '204':
 *         description: Success
 */
drop(
  '/locations/:id/lists/:list_id',
  middleware.authenticate('user'),
  async (req, res) => {
    // Restrict to linked user
    const list = await db.locationLists.showList(req.params.list_id)
    if (list.user_id != req.user.id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    await db.locationLists.dropLocationFromList(req.params.id, req.params.list_id)
    return void res.status(204).send()
  }
)

// Routes: Locations
/**
 * @openapi
 * /locations:
 *   get:
 *     summary: Fetch Location summaries.
 *     tags:
 *       - Locations
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - name: ids
 *         in: query
 *         description: Location IDs. If provided, other filters (`bounds`, `muni`, `types`, `invasives`) are ignored and locations are returned whether or not they are hidden.
 *         explode: false
 *         schema:
 *           type: array
 *           uniqueItems: true
 *           items:
 *             type: integer
 *             minimum: 0
 *           default: null
 *       - name: bounds
 *         in: query
 *         description: The southwest and northeast corners of the bounding box in WGS84 decimal degrees, in the format `swlat,swlng|nelat,nelng`. Latitude must be in the interval [-85.0511, 85.0511] and longitude must be in the interval [-180, 180]. Required if `center` is not provided.
 *         explode: false
 *         style: pipeDelimited
 *         schema:
 *           type: array
 *           minItems: 2
 *           maxItems: 2
 *           items:
 *             type: string
 *             pattern: '^(-?\d+\.?(\d+)?),(-?\d+\.?(\d+)?)$'
 *           example: ['-5,-180', '5,180']
 *       - name: center
 *         in: query
 *         description: Center `latitude,longitude` in WGS84 decimal degrees. If provided, Locations are returned in order of increasing distance and the distance to each Location is returned. Longitude must be in the interval [-180, 180] and latitude in the interval [-90, 90].
 *         explode: false
 *         schema:
 *           type: array
 *           minItems: 2
 *           maxItems: 2
 *           items:
 *             type: number
 *             minimum: -180
 *             maximum: 180
 *           example: [1.359, 103.807]
 *       - $ref: '#/components/parameters/muni'
 *       - $ref: '#/components/parameters/types'
 *       - $ref: '#/components/parameters/invasive'
 *       - name: limit
 *         in: query
 *         description: Maximum number of Locations to return.
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 1000
 *       - $ref: '#/components/parameters/offset'
 *       - name: photo
 *         in: query
 *         description: Whether to include the path to a review photo thumbnail, if available.
 *         schema:
 *           type: boolean
 *           default: false
 *       - name: count
 *         in: query
 *         description: Whether to include the total number of locations matching the query in the `x-total-count` header.
 *         schema:
 *           type: boolean
 *           default: false
 *       - name: locale
 *         in: query
 *         description: Whether (and in which language) to include a name for each Location Type, as an ISO 639-1 language code or `scientific` for the scientific (latin) name (applicable to lifeforms only). To guarantee that the name is not null, the first non-null name is provided from the requested locale, `en` (English), or `scientific`. Ignored if `center` is provided.
 *         schema:
 *           type: string
 *           deprecated: true
 *     responses:
 *       '200':
 *         description: Success
 *         headers:
 *           x-total-count:
 *             schema:
 *               type: integer
 *             description: |-
 *               Total number of locations meeting the query conditions (if `count=true`).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ListLocation'
 */
get(
  '/locations',
  middleware.authenticate(),
  async (req, res) => {
    const locations = await db.locations.list(req.query, req.user)
    if (req.query.count === 'true') {
      const limit = req.query.limit ? parseInt(req.query.limit) : 1000
      let count = locations.length
      if (locations.length === limit) {
        count = (await db.locations.count(req.query)).count
      }
      res.set({'x-total-count': count})
    }
    return locations
  }
)
/**
 * @openapi
 * /locations:
 *   post:
 *     tags:
 *       - Locations
 *     summary: Create a Location.
 *     description: A `review` can be included, in which case the result includes the `reviews` property.
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/recaptcha'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddLocation'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 */
post(
  '/locations',
  middleware.authenticate(),
  middleware.recaptcha,
  middleware.test_review('review'),
  async req => {
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const user_id = req.user ? req.user.id : null
    let photos
    if (req.body.review) {
      photos = await db.photos.test_unlinked(req.body.review.photo_ids)
    }
    const location = await db.locations.add({...req.body, user_id: user_id})
    if (req.body.review) {
      const review = await db.reviews.add(
        location.id, {...req.body.review, user_id: user_id}
      )
      await db.photos.link(req.body.review.photo_ids, review.id)
      review.photos = photos
      location.reviews = [review]
    }
    await db.clusters.increment(location)
    return location
  }
)
/**
 * @openapi
 * /locations/count:
 *   get:
 *     summary: Count Locations.
 *     tags:
 *       - Locations
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/bounds'
 *       - $ref: '#/components/parameters/muni'
 *       - $ref: '#/components/parameters/types'
 *       - $ref: '#/components/parameters/invasive'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: number
 *               example: 25
 */
get(
  '/locations/count',
  req => db.locations.count(req.query)
)
/**
 * @openapi
 * /locations/changes:
 *   get:
 *     summary: Fetch Location changes (activity).
 *     description: |
 *       A change event is recorded when a location is added (`'added'`), a location is edited (`'edited'`), or a location is reviewed (`'visited'`). Results are sorted in reverse chronological order (most recent first).
 *
 *       Filtering by user `range` is restricted to the user.
 *     tags:
 *       - Locations
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - name: earliest
 *         in: query
 *         description: Earliest UTC datetime of change (inclusive).
 *         schema:
 *           type: string
 *           format: date-time
 *           default: null
 *         example: '2024-11-09T00:00:00Z'
 *       - name: latest
 *         in: query
 *         description: Latest UTC datetime of change (exclusive).
 *         schema:
 *           type: string
 *           format: date-time
 *           default: null
 *         example: null
 *       - name: user_id
 *         in: query
 *         description: User ID of changes to return.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: null
 *       - name: range
 *         in: query
 *         description: Whether to filter changes within the foraging range of the user with `user_id`, rather than by the user.
 *         schema:
 *           type: boolean
 *           default: false
 *         example: false
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationChange'
 */
get(
  '/locations/changes',
  middleware.authenticate(),
  async (req, res) => {
    if (req.query.user_id && (!req.user || req.user.id != parseInt(req.query.user_id))) {
      // Cannot filter by other user's foraging range
      if (req.query.range === 'true') {
        return void res.status(403).json({error: 'Only a user can filter by their own foraging range'})
      }
      const user = await db.users.show(req.query.user_id)
    }
    return db.changes.list(req.query)
  }
)
/**
 * @openapi
 * /locations/{id}:
 *   get:
 *     summary: Fetch a Location.
 *     tags:
 *       - Locations
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *       - name: embed
 *         description: |
 *           Additional information to include.
 *           - reviews: Location reviews.
 *           - import: Imported dataset.
 *         in: query
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [reviews, import]
 *           default: null
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 */
get(
  '/locations/:id',
  middleware.authenticate(),
  async req => {
    const location = await db.locations.show(req.params.id, req.user)
    if (req.query.embed) {
      const embedded = req.query.embed.split(',')
      if (embedded.includes('reviews')) {
        location.reviews = await db.reviews.list(req.params.id)
      }
      if (embedded.includes('import') && location.import_id) {
        location.import = await db.imports.show(location.import_id)
        delete location.import_id
      }
    }
    return location
  }
)
/**
 * @openapi
 * /locations/{id}:
 *   put:
 *     tags:
 *       - Locations
 *     summary: Edit a Location.
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *       - $ref: '#/components/parameters/recaptcha'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditLocation'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 */
put(
  '/locations/:id',
  middleware.authenticate(),
  middleware.recaptcha,
  async req => {
    const old = await db.locations.show(req.params.id)
    const updated = await db.locations.edit(req.params.id, req.body, req.user)
    // Decrement first in case location properties have changed
    if (
      updated.lat != old.lat || updated.lng != old.lng ||
      updated.muni != old.muni || !set_equal(updated.type_ids, old.type_ids)
    ) {
      await db.clusters.decrement(old)
      await db.clusters.increment(updated)
    }
    return updated
  }
)
/**
 * @openapi
 * /locations/{id}:
 *   delete:
 *     summary: Delete a Location.
 *     description: Restricted to the same user that created the location. Deletion is only permitted if the location is not associated with any reviews other than their own and no other (non-admin) user edited the location in the meantime.
 *     tags:
 *       - Locations
 *     security:
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *     responses:
 *       '204':
 *         description: Success (no content)
 */
drop(
  '/locations/:id',
  middleware.authenticate('user'),
  async (req, res) => {
    const original = await db.locations.show(req.params.id)
    // Restrict to linked user
    if (req.user.id != original.user_id) {
      return void res.status(403).json(
        {error: 'Location was created by another user'}
      )
    }
    // Check that all associated reviews belong to the user
    const reviews = await db.reviews.list(req.params.id)
    for (const review of reviews) {
      if (review.user_id != req.user.id) {
        return void res.status(403).json(
          {error: 'Location contains reviews from other users'}
        )
      }
    }
    // Check that no other (non-admin) user edited the location in the meantime
    const changes = await db.changes.list_location_edits(req.params.id)
    for (const change of changes) {
      if (change.user_id != req.user.id) {
        let user
        if (change.user_id) {
          // Retrieve user details
          user = await db.users.show(change.user_id)
        }
        // Abort if user is not same user or an admin
        if (!user || !user.roles.includes('admin')) {
          return void res.status(403).json(
            {error: 'Location was edited by another user'}
          )
        }
      }
    }
    // Delete location
    await db.locations.delete(req.params.id)
    return void res.status(204).send()
  }
)

// Routes: Reviews
/**
 * @openapi
 * /locations/{id}/reviews:
 *   get:
 *     summary: Fetch a Location's Reviews.
 *     tags:
 *       - Reviews
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 */
get(
  '/locations/:id/reviews',
  req => db.reviews.list(req.params.id)
)
/**
 * @openapi
 * /locations/{id}/reviews:
 *   post:
 *     summary: Review a Location.
 *     description: If `fruiting` is provided, `observed_on` is required. One of `comment`, `fruiting`, `quality_rating`, `yield_rating`, or `photo_ids` is required.
 *     tags:
 *       - Reviews
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/location_id'
 *       - $ref: '#/components/parameters/recaptcha'
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
 *       '400':
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   description: Error message
 *                   type: string
 *                   example: observed_on is required if fruiting is provided
 */
post(
  '/locations/:id/reviews',
  middleware.authenticate(),
  middleware.recaptcha,
  middleware.test_review(),
  async req => {
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const photos = await db.photos.test_unlinked(req.body.photo_ids)
    const review = await db.reviews.add(
      req.params.id, {...req.body, user_id: req.user ? req.user.id : null}
    )
    await db.photos.link(req.body.photo_ids, review.id)
    review.photos = photos
    return review
  }
)

  return router
}
