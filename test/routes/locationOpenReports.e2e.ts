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

async function seedReport(
  locationId: number,
  {
    problem_code = 1,
    comment = null,
    email = 'reporter@example.com',
    name = 'Jane',
    reporter_id = null,
    resolution_code = null,
  }: {
    problem_code?: number | null
    comment?: string | null
    email?: string
    name?: string | null
    reporter_id?: number | null
    resolution_code?: number | null
  } = {},
) {
  return setup.db.one<{ id: number }>(
    `INSERT INTO problems (
       location_id, reporter_id, name, email, problem_code, comment, resolution_code
     ) VALUES (
       \${location_id}, \${reporter_id}, \${name}, \${email}, \${problem_code}, \${comment}, \${resolution_code}
     ) RETURNING id`,
    {
      location_id: locationId,
      reporter_id,
      name,
      email,
      problem_code,
      comment,
      resolution_code,
    },
  )
}

type OpenReport = {
  created_at: string
  problem_code: number
  comment?: string | null
  reported_by_me?: boolean
  reporter?: { user_id: number | null; name: string | null; email: string }
}

test('GET /locations/:id returns an empty open_reports array when there are none', async () => {
  const locationId = await seedLocation()

  const result = await setup.request(`/locations/${locationId}`)

  assert.equal(result.status, 200)
  const body = result.body as { open_reports: OpenReport[] }
  assert.deepEqual(body.open_reports, [])
})

test('GET /locations/:id exposes only created_at and problem_code to anonymous users', async () => {
  const locationId = await seedLocation()
  await seedReport(locationId, {
    problem_code: 1,
    comment: 'secret comment',
    email: 'reporter@example.com',
    name: 'Jane',
  })

  const result = await setup.request(`/locations/${locationId}`)

  assert.equal(result.status, 200)
  const body = result.body as { open_reports: OpenReport[] }
  assert.equal(body.open_reports.length, 1)
  const [report] = body.open_reports
  assert.equal(report.problem_code, 1)
  assert.ok(report.created_at)
  assert.equal(report.comment, undefined)
  assert.equal(report.reporter, undefined)
  assert.equal(report.reported_by_me, undefined)
})

test('GET /locations/:id adds reported_by_me for an authenticated non-admin user, but no comment or reporter', async () => {
  const locationId = await seedLocation()
  const user = await setup.createUser({ email: 'user@example.com' })
  await seedReport(locationId, {
    problem_code: 2,
    comment: 'secret comment',
    reporter_id: user.id,
    email: 'user@example.com',
    name: 'Test User',
  })
  await seedReport(locationId, {
    problem_code: 3,
    comment: 'another comment',
    reporter_id: null,
    email: 'other@example.com',
    name: 'Other',
  })

  const result = await setup.request(`/locations/${locationId}`, {
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { open_reports: OpenReport[] }
  assert.equal(body.open_reports.length, 2)
  const mine = body.open_reports.find((r) => r.problem_code === 2)
  const theirs = body.open_reports.find((r) => r.problem_code === 3)
  assert.ok(mine)
  assert.ok(theirs)
  assert.equal(mine.reported_by_me, true)
  assert.equal(theirs.reported_by_me, false)
  assert.equal(mine.comment, undefined)
  assert.equal(mine.reporter, undefined)
})

test('GET /locations/:id exposes comment and reporter to an admin', async () => {
  const locationId = await seedLocation()
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['admin'],
  })
  await seedReport(locationId, {
    problem_code: 1,
    comment: 'This tree was cut down.',
    reporter_id: null,
    email: 'reporter@example.com',
    name: 'Jane',
  })

  const result = await setup.request(`/locations/${locationId}`, {
    headers: admin.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { open_reports: OpenReport[] }
  assert.equal(body.open_reports.length, 1)
  const [report] = body.open_reports
  assert.equal(report.comment, 'This tree was cut down.')
  assert.deepEqual(report.reporter, {
    user_id: null,
    name: 'Jane',
    email: 'reporter@example.com',
  })
  assert.equal(report.reported_by_me, false)
})

test('GET /locations/:id excludes resolved reports and maps a null problem_code to 5', async () => {
  const locationId = await seedLocation()
  await seedReport(locationId, {
    problem_code: null,
  })
  await seedReport(locationId, {
    problem_code: 0,
    resolution_code: 2,
  })

  const result = await setup.request(`/locations/${locationId}`)

  assert.equal(result.status, 200)
  const body = result.body as { open_reports: OpenReport[] }
  assert.equal(body.open_reports.length, 1)
  assert.equal(body.open_reports[0].problem_code, 5)
})
