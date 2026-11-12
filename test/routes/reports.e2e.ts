import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'
import type { AdminReport, ResolvedReport } from '../../src/schemas/schemas'

const setup = setupE2E({
  tables: ['problems', 'changes', 'locations', 'users', 'refresh_tokens'],
})

test('reports can be created, listed as open, resolved, and listed as resolved', async () => {
  const location = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['admin'],
  })

  const created = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: location.id,
      problem_code: 1,
      email: 'reporter@example.com',
      comment: 'This location does not exist.',
    },
  })
  assert.equal(created.status, 200)
  const reportId = (created.body as { id: number }).id

  const open = await setup.request('/reports/open', {
    headers: admin.authHeaders,
  })
  assert.equal(open.status, 200)
  const openBody = open.body as AdminReport[]
  assert.equal(openBody.length, 1)
  assert.equal(openBody[0].id, reportId)
  assert.equal('resolution' in openBody[0], false)
  assert.deepEqual(openBody[0].location, {
    id: location.id,
    lat: 40,
    lng: -88,
    type_ids: [1],
    address: null,
  })

  const resolvedEmpty = await setup.request('/reports/resolved', {
    headers: admin.authHeaders,
  })
  assert.equal(resolvedEmpty.status, 200)
  assert.equal((resolvedEmpty.body as ResolvedReport[]).length, 0)

  const resolved = await setup.request('/reports/resolution', {
    method: 'POST',
    body: {
      report_ids: [reportId],
      resolution: { code: 2, response: 'Deleted it.' },
    },
    headers: admin.authHeaders,
  })
  assert.equal(resolved.status, 200)
  const resolvedResult = resolved.body as {
    resolved: { id: number }[]
    emails: { sent: string[]; failed: { email: string; error: string }[] }
  }
  assert.equal(resolvedResult.resolved.length, 1)
  assert.equal(resolvedResult.resolved[0].id, reportId)
  assert.deepEqual(resolvedResult.emails, { sent: [], failed: [] })

  const openAfter = await setup.request('/reports/open', {
    headers: admin.authHeaders,
  })
  assert.equal(openAfter.status, 200)
  assert.equal((openAfter.body as AdminReport[]).length, 0)

  const resolvedList = await setup.request('/reports/resolved', {
    headers: admin.authHeaders,
  })
  assert.equal(resolvedList.status, 200)
  const resolvedBody = resolvedList.body as ResolvedReport[]
  assert.equal(resolvedBody.length, 1)
  assert.equal(resolvedBody[0].id, reportId)
  assert.equal(resolvedBody[0].location, null)
  assert.equal(typeof resolvedBody[0].resolved_at, 'string')
  assert.deepEqual(resolvedBody[0].resolution, {
    code: 2,
    response: 'Deleted it.',
    responder: { id: admin.id, name: 'Test User' },
  })
})

test('resolved reports support search and filter query parameters', async () => {
  const locationA = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  const locationB = await setup.db.locations.add({
    lat: 41,
    lng: -89,
    type_ids: [1],
  })
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['admin'],
  })

  const first = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationA.id,
      problem_code: 1,
      email: 'alice@example.com',
      name: 'Alice',
      comment: 'Tree was cut down.',
    },
  })
  const second = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationB.id,
      problem_code: 2,
      email: 'bob@example.com',
      name: 'Bob',
      comment: 'Duplicate of another entry.',
    },
  })
  const firstId = (first.body as { id: number }).id
  const secondId = (second.body as { id: number }).id

  await setup.request('/reports/resolution', {
    method: 'POST',
    body: {
      report_ids: [firstId],
      resolution: { code: 1, response: 'Fixed the location.' },
    },
    headers: admin.authHeaders,
  })
  await setup.request('/reports/resolution', {
    method: 'POST',
    body: {
      report_ids: [secondId],
      resolution: { code: 2, response: 'Removed the duplicate.' },
    },
    headers: admin.authHeaders,
  })

  const byComment = await setup.request('/reports/resolved?q=duplicate', {
    headers: admin.authHeaders,
  })
  assert.equal(byComment.status, 200)
  const byCommentBody = byComment.body as ResolvedReport[]
  assert.equal(byCommentBody.length, 1)
  assert.equal(byCommentBody[0].id, secondId)

  const byReporter = await setup.request('/reports/resolved?q=alice', {
    headers: admin.authHeaders,
  })
  assert.equal((byReporter.body as ResolvedReport[]).length, 1)
  assert.equal((byReporter.body as ResolvedReport[])[0].id, firstId)

  const byProblemCode = await setup.request(
    '/reports/resolved?problem_code=2',
    { headers: admin.authHeaders },
  )
  const byProblemBody = byProblemCode.body as ResolvedReport[]
  assert.equal(byProblemBody.length, 1)
  assert.equal(byProblemBody[0].id, secondId)

  const byResolutionCode = await setup.request(
    '/reports/resolved?resolution_code=1',
    { headers: admin.authHeaders },
  )
  const byResolutionBody = byResolutionCode.body as ResolvedReport[]
  assert.equal(byResolutionBody.length, 1)
  assert.equal(byResolutionBody[0].id, firstId)

  const oldestFirst = await setup.request('/reports/resolved?sort=oldest', {
    headers: admin.authHeaders,
  })
  const oldestBody = oldestFirst.body as ResolvedReport[]
  assert.equal(oldestBody.length, 2)
  assert.equal(oldestBody[0].id, firstId)
  assert.equal(oldestBody[1].id, secondId)
})

test('reporter notifications are best-effort and reported per recipient', async () => {
  const locationA = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  const locationB = await setup.db.locations.add({
    lat: 41,
    lng: -89,
    type_ids: [1],
  })
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['admin'],
  })

  const first = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationA.id,
      problem_code: 1,
      email: 'good@example.com',
      name: 'Good',
      comment: 'Tree was cut down.',
    },
  })
  const second = await setup.request('/reports', {
    method: 'POST',
    body: {
      location_id: locationB.id,
      problem_code: 2,
      email: 'bad@example.com',
      name: 'Bad',
      comment: 'Duplicate of another entry.',
    },
  })
  const firstId = (first.body as { id: number }).id
  const secondId = (second.body as { id: number }).id

  const original = setup.postmark.sendEmail.bind(setup.postmark)
  setup.postmark.sendEmail = (email) => {
    if (String(email.To).includes('bad@example.com')) {
      return Promise.reject(new Error('Inactive recipient'))
    }
    return original(email)
  }

  let result: {
    resolved: { id: number }[]
    emails: { sent: string[]; failed: { email: string; error: string }[] }
  }
  try {
    const resolved = await setup.request(
      '/reports/resolution?notify_reporters=true',
      {
        method: 'POST',
        body: {
          report_ids: [firstId, secondId],
          resolution: { code: 1, response: 'Handled.' },
        },
        headers: admin.authHeaders,
      },
    )
    assert.equal(resolved.status, 200)
    result = resolved.body as typeof result
  } finally {
    setup.postmark.sendEmail = original
  }

  assert.equal(result.resolved.length, 2)
  assert.deepEqual(result.emails.sent, ['good@example.com'])
  assert.equal(result.emails.failed.length, 1)
  assert.equal(result.emails.failed[0].email, 'bad@example.com')
  assert.equal(result.emails.failed[0].error, 'Inactive recipient')

  // The good email still went out despite the other failing.
  assert.equal(
    setup.postmark.calls.filter((email) =>
      String(email.To).includes('good@example.com'),
    ).length,
    1,
  )

  // Both reports are resolved regardless of notification outcome.
  const resolvedList = await setup.request('/reports/resolved', {
    headers: admin.authHeaders,
  })
  assert.equal((resolvedList.body as ResolvedReport[]).length, 2)
})
