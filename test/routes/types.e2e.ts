import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: ['types', 'locations', 'users', 'refresh_tokens'],
})

test('GET /types lists all types', async () => {
  await setup.db.types.add({ common_names: { en: ['Apple'] } })
  await setup.db.types.add({ common_names: { en: ['Pear'] } })

  const result = await setup.request('/types')

  assert.equal(result.status, 200)
  const body = result.body as { common_names: Record<string, string[]> }[]
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 2)
  const names = body.map((type) => type.common_names.en[0]).sort()
  assert.deepEqual(names, ['Apple', 'Pear'])
})

test('GET /types/:id fetches a single type', async () => {
  const added = await setup.db.types.add({ common_names: { en: ['Apple'] } })

  const result = await setup.request(`/types/${added.id}`)

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    common_names: Record<string, string[]>
  }
  assert.equal(body.id, added.id)
  assert.deepEqual(body.common_names.en, ['Apple'])
})

test('POST /types creates a pending type', async () => {
  const result = await setup.request('/types', {
    method: 'POST',
    body: { common_names: { en: ['Fig'] } },
  })

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    pending: boolean
    common_names: Record<string, string[]>
  }
  assert.equal(body.pending, true)
  assert.deepEqual(body.common_names.en, ['Fig'])

  const row = await setup.db.one<{ en_name: string; pending: boolean }>(
    'SELECT en_name, pending FROM types WHERE id = ${id}',
    { id: body.id },
  )
  assert.equal(row.en_name, 'Fig')
  assert.equal(row.pending, true)
})

test('POST /types rejects pending: false from a non-admin', async () => {
  const result = await setup.request('/types', {
    method: 'POST',
    body: { common_names: { en: ['Fig'] }, pending: false },
  })

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, {
    error: 'Only admins can approve a type (pending: false)',
  })
})

test('POST /types allows pending: false from an admin', async () => {
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })

  const result = await setup.request('/types', {
    method: 'POST',
    body: { common_names: { en: ['Fig'] }, pending: false },
    headers: admin.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { pending: boolean }
  assert.equal(body.pending, false)
})

test('GET /types/counts returns counts within bounds', async () => {
  const result = await setup.request('/types/counts?bounds=-5,-5|5,5')

  assert.equal(result.status, 200)
  assert.ok(Array.isArray(result.body))
})
