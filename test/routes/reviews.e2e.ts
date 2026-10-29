import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: [
    'observations',
    'photos',
    'changes',
    'locations',
    'users',
    'refresh_tokens',
  ],
})

async function seedLocation() {
  const location = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  return location.id
}

test('GET /reviews/:id returns the review with its photos', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Delicious.',
  })

  const result = await setup.request(`/reviews/${review.id}`)

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    location_id: number
    comment: string
    photos: unknown[]
  }
  assert.equal(body.id, review.id)
  assert.equal(body.location_id, locationId)
  assert.equal(body.comment, 'Delicious.')
  assert.deepEqual(body.photos, [])
})

test('PUT /reviews/:id lets the author edit their review', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Original.',
  })

  const result = await setup.request(`/reviews/${review.id}`, {
    method: 'PUT',
    body: { comment: 'Edited.' },
    headers: author.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; comment: string }
  assert.equal(body.id, review.id)
  assert.equal(body.comment, 'Edited.')
})

test('PUT /reviews/:id is forbidden for a non-author', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const other = await setup.createUser({ email: 'other@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Original.',
  })

  const result = await setup.request(`/reviews/${review.id}`, {
    method: 'PUT',
    body: { comment: 'Edited.' },
    headers: other.authHeaders,
  })

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, { error: 'Insufficient permissions' })
})

test('PUT /reviews/:id requires observed_on when fruiting is provided', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Original.',
  })

  const result = await setup.request(`/reviews/${review.id}`, {
    method: 'PUT',
    body: { fruiting: 2 },
    headers: author.authHeaders,
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, {
    error: 'observed_on is required when fruiting is provided',
  })
})

test('DELETE /reviews/:id lets the author delete their review', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Original.',
  })

  const result = await setup.request(`/reviews/${review.id}`, {
    method: 'DELETE',
    headers: author.authHeaders,
  })

  assert.equal(result.status, 204)

  const remaining = await setup.db.oneOrNone(
    'SELECT id FROM observations WHERE id = ${id}',
    { id: review.id },
  )
  assert.equal(remaining, null)
})

test('DELETE /reviews/:id is forbidden for a non-author', async () => {
  const author = await setup.createUser({ email: 'author@example.com' })
  const other = await setup.createUser({ email: 'other@example.com' })
  const locationId = await seedLocation()
  const review = await setup.db.reviews.add(locationId, {
    user_id: author.id,
    comment: 'Original.',
  })

  const result = await setup.request(`/reviews/${review.id}`, {
    method: 'DELETE',
    headers: other.authHeaders,
  })

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, { error: 'Insufficient permissions' })
})
