import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: [
    'locations_routes',
    'routes',
    'observations',
    'photos',
    'problems',
    'changes',
    'clusters',
    'locations',
    'imports',
    'users',
    'refresh_tokens',
  ],
})

async function seedLocation(
  overrides: Record<string, unknown> = {},
) {
  return setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
    ...overrides,
  })
}

// Routes: Locations

test('GET /locations returns summaries within bounds', async () => {
  const location = await seedLocation()

  const result = await setup.request('/locations?bounds=35,-90|45,-85')

  assert.equal(result.status, 200)
  const body = result.body as { id: number; lat: number; lng: number }[]
  assert.equal(body.length, 1)
  assert.equal(body[0].id, location.id)
})

test('GET /locations with count=true sets the x-total-count header', async () => {
  await seedLocation()

  const result = await setup.request(
    '/locations?bounds=35,-90|45,-85&count=true',
  )

  assert.equal(result.status, 200)
  assert.equal(result.response.headers.get('x-total-count'), '1')
})

test('POST /locations creates a location', async () => {
  const result = await setup.request('/locations', {
    method: 'POST',
    body: { lat: 40, lng: -88, type_ids: [1] },
  })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; lat: number; type_ids: number[] }
  assert.equal(body.lat, 40)
  assert.deepEqual(body.type_ids, [1])

  const row = await setup.db.one<{ id: number }>(
    'SELECT id FROM locations WHERE id = ${id}',
    { id: body.id },
  )
  assert.equal(row.id, body.id)
})

test('POST /locations with a review includes the reviews property', async () => {
  const result = await setup.request('/locations', {
    method: 'POST',
    body: {
      lat: 40,
      lng: -88,
      type_ids: [1],
      review: { comment: 'Looks healthy.' },
    },
  })

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    reviews: { comment: string }[]
  }
  assert.ok(Array.isArray(body.reviews))
  assert.equal(body.reviews.length, 1)
  assert.equal(body.reviews[0].comment, 'Looks healthy.')
})

test('GET /locations/count counts locations within bounds', async () => {
  await seedLocation()

  const result = await setup.request('/locations/count?bounds=35,-90|45,-85')

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { count: 1 })
})

test('GET /locations/:id fetches a location', async () => {
  const location = await seedLocation()

  const result = await setup.request(`/locations/${location.id}`)

  assert.equal(result.status, 200)
  const body = result.body as { id: number; lat: number; lng: number }
  assert.equal(body.id, location.id)
  assert.equal(body.lat, 40)
})

test('GET /locations/:id?embed=reviews includes reviews', async () => {
  const location = await seedLocation()
  await setup.db.reviews.add(location.id, { comment: 'Tasty.' })

  const result = await setup.request(
    `/locations/${location.id}?embed=reviews`,
  )

  assert.equal(result.status, 200)
  const body = result.body as { reviews: { comment: string }[] }
  assert.equal(body.reviews.length, 1)
  assert.equal(body.reviews[0].comment, 'Tasty.')
})

test('PUT /locations/:id edits a location', async () => {
  const location = await seedLocation()

  const result = await setup.request(`/locations/${location.id}`, {
    method: 'PUT',
    body: { lat: 41, lng: -87, type_ids: [2] },
  })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; lat: number; type_ids: number[] }
  assert.equal(body.lat, 41)
  assert.deepEqual(body.type_ids, [2])
})

test('DELETE /locations/:id lets the author delete their location', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const location = await seedLocation({ user_id: author.id })

  const result = await setup.request(`/locations/${location.id}`, {
    method: 'DELETE',
    headers: author.authHeaders,
  })

  assert.equal(result.status, 204)
  const row = await setup.db.oneOrNone<{ id: number }>(
    'SELECT id FROM locations WHERE id = ${id}',
    { id: location.id },
  )
  assert.equal(row, null)
})

test('DELETE /locations/:id is forbidden for a non-author', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const other = await setup.createUser({ email: 'other@example.com' })
  const location = await seedLocation({ user_id: author.id })

  const result = await setup.request(`/locations/${location.id}`, {
    method: 'DELETE',
    headers: other.authHeaders,
  })

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, {
    error: 'Location was created by another user',
  })
})

// Routes: Location changes

test('GET /locations/changes returns change activity', async () => {
  await seedLocation()

  const result = await setup.request('/locations/changes')

  assert.equal(result.status, 200)
  const body = result.body as { description: string; location_id: number }[]
  assert.ok(Array.isArray(body))
  assert.ok(body.some((change) => change.description === 'added'))
})

test('GET /locations/changes restricts range filtering to the user', async () => {
  const user = await setup.createUser({ email: 'ranger@example.com' })

  const result = await setup.request(
    `/locations/changes?user_id=${user.id + 1}&range=true`,
  )

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, {
    error: 'Only a user can filter by their own foraging range',
  })
})

// Routes: Location lists

test('POST /locations/lists creates a list', async () => {
  const user = await setup.createUser()

  const result = await setup.request('/locations/lists', {
    method: 'POST',
    body: { name: 'Favorites' },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; name: string; user_id: number }
  assert.equal(body.name, 'Favorites')
  assert.equal(body.user_id, user.id)
})

test('POST /locations/lists requires a name', async () => {
  const user = await setup.createUser()

  const result = await setup.request('/locations/lists', {
    method: 'POST',
    body: { description: 'No name here' },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, {
    error: 'name: Invalid input: expected string, received undefined',
  })
})

test("GET /locations/lists returns the user's lists", async () => {
  const user = await setup.createUser()
  await setup.db.locationLists.addList({ name: 'Favorites' }, { id: user.id })

  const result = await setup.request('/locations/lists', {
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { name: string }[]
  assert.equal(body.length, 1)
  assert.equal(body[0].name, 'Favorites')
})

test('GET /locations/lists/:list_id returns a single list', async () => {
  const user = await setup.createUser()
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: user.id },
  )

  const result = await setup.request(`/locations/lists/${list.id}`, {
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; name: string }
  assert.equal(body.id, list.id)
  assert.equal(body.name, 'Favorites')
})

test('PUT /locations/lists/:list_id lets the owner edit the list', async () => {
  const user = await setup.createUser()
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: user.id },
  )

  const result = await setup.request(`/locations/lists/${list.id}`, {
    method: 'PUT',
    body: { name: 'Renamed' },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { name: string }
  assert.equal(body.name, 'Renamed')
})

test('PUT /locations/lists/:list_id is forbidden for a non-owner', async () => {
  const owner = await setup.createUser({ email: 'owner@example.com' })
  const other = await setup.createUser({ email: 'other@example.com' })
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: owner.id },
  )

  const result = await setup.request(`/locations/lists/${list.id}`, {
    method: 'PUT',
    body: { name: 'Renamed' },
    headers: other.authHeaders,
  })

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, { error: 'Insufficient permissions' })
})

test('DELETE /locations/lists/:list_id lets the owner delete the list', async () => {
  const user = await setup.createUser()
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: user.id },
  )

  const result = await setup.request(`/locations/lists/${list.id}`, {
    method: 'DELETE',
    headers: user.authHeaders,
  })

  assert.equal(result.status, 204)
})

test('POST and DELETE /locations/:id/lists/:list_id add and remove a location', async () => {
  const user = await setup.createUser()
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: user.id },
  )
  const location = await seedLocation()

  const addResult = await setup.request(
    `/locations/${location.id}/lists/${list.id}`,
    { method: 'POST', headers: user.authHeaders },
  )
  assert.equal(addResult.status, 204)

  const added = await setup.db.one<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM locations_routes WHERE route_id = ${id}',
    { id: list.id },
  )
  assert.equal(added.n, 1)

  const dropResult = await setup.request(
    `/locations/${location.id}/lists/${list.id}`,
    { method: 'DELETE', headers: user.authHeaders },
  )
  assert.equal(dropResult.status, 204)

  const remaining = await setup.db.one<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM locations_routes WHERE route_id = ${id}',
    { id: list.id },
  )
  assert.equal(remaining.n, 0)
})

// Routes: Reviews on a location

test("GET /locations/:id/reviews lists a location's reviews", async () => {
  const location = await seedLocation()
  await setup.db.reviews.add(location.id, { comment: 'Great.' })

  const result = await setup.request(`/locations/${location.id}/reviews`)

  assert.equal(result.status, 200)
  const body = result.body as { comment: string }[]
  assert.equal(body.length, 1)
  assert.equal(body[0].comment, 'Great.')
})

test('POST /locations/:id/reviews creates a review', async () => {
  const location = await seedLocation()

  const result = await setup.request(`/locations/${location.id}/reviews`, {
    method: 'POST',
    body: { comment: 'Fresh fruit.' },
  })

  assert.equal(result.status, 200)
  const body = result.body as { location_id: number; comment: string }
  assert.equal(body.location_id, location.id)
  assert.equal(body.comment, 'Fresh fruit.')
})

test('POST /locations/:id/reviews requires observed_on when fruiting is provided', async () => {
  const location = await seedLocation()

  const result = await setup.request(`/locations/${location.id}/reviews`, {
    method: 'POST',
    body: { fruiting: 2 },
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, {
    error: 'observed_on is required when fruiting is provided',
  })
})
