const db = require('../db')
const middleware = require('../middleware')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

const set_equal = function(a, b) {
  return a.length === b.length && a.every(value => b.includes(value))
}

// Routes: Location lists
post(
  '/lists',
  middleware.authenticate('user'),
  async (req, res) => {
    // Require name
    if (!req.body.name) {
      return void res.status(400).json({error: 'Name is required'})
    }
    return await db.locationLists.addList(req.body, req.user)
  }
)
get(
  '/lists',
  middleware.authenticate('user'),
  async (req) => {
    if (req.query.embed === 'locations') {
      return await db.locationLists.listUserListsWithLocations(req.user.id)
    }
    return await db.locationLists.listUserLists(req.user.id)
  }
)
get(
  '/lists/:id',
  middleware.authenticate('user'),
  async (req) => {
    if (req.query.embed === 'locations') {
      return await db.locationLists.listUserListsWithLocations(req.user.id)
    }
    return await db.locationLists.listUserLists(req.user.id)
  }
)
put(
  '/lists/:id',
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
drop(
  '/lists/:id',
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
post(
  '/:id/lists/:list_id',
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
drop(
  '/:id/lists/:list_id',
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
get(
  '/',
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
post(
  '/',
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
get(
  '/count',
  req => db.locations.count(req.query)
)
get(
  '/changes',
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
get(
  '/:id',
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
put(
  '/:id',
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
drop(
  '/:id',
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
get(
  '/:id/reviews',
  req => db.reviews.list(req.params.id)
)
post(
  '/:id/reviews',
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

module.exports = router
