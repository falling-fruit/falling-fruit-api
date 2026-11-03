import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: ['problems', 'changes', 'locations', 'users', 'refresh_tokens'],
})

async function seedLocation() {
  const location = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  return location.id
}

test('POST /reports creates a report with a provided email', async () => {
  const locationId = await seedLocation()

  const result = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationId,
      problem_code: 1,
      email: 'reporter@example.com',
      comment: 'This location does not exist.',
    },
  })

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    location_id: number
    problem_code: number
    email: string
    comment: string
  }
  assert.equal(body.location_id, locationId)
  assert.equal(body.problem_code, 1)
  assert.equal(body.email, 'reporter@example.com')

  const row = await setup.db.one<{ email: string; problem_code: number }>(
    'SELECT email, problem_code FROM problems WHERE id = ${id}',
    { id: body.id },
  )
  assert.equal(row.email, 'reporter@example.com')
  assert.equal(row.problem_code, 1)
})

test('POST /reports defaults the email to the authenticated user', async () => {
  const locationId = await seedLocation()
  const user = await setup.createUser({ email: 'owner@example.com' })

  const result = await setup.request('/reports', {
    method: 'POST',
    body: { location_id: locationId, problem_code: 1 },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { email: string; reporter_id: number }
  assert.equal(body.email, 'owner@example.com')
  assert.equal(body.reporter_id, user.id)
})

test('POST /reports requires an email when not authenticated', async () => {
  const locationId = await seedLocation()

  const result = await setup.request('/reports', {
    method: 'POST',
    body: { location_id: locationId, problem_code: 1 },
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, { error: 'An email is required' })
})

test('POST /reports requires a comment when problem_code is 5', async () => {
  const locationId = await seedLocation()

  const result = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationId,
      problem_code: 5,
      email: 'reporter@example.com',
    },
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, {
    error: 'comment is required when problem_code = 5',
  })
})
