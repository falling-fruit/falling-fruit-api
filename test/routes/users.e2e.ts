import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['users', 'refresh_tokens'] })

test('GET /users/:id returns the public user', async () => {
  const user = await setup.createUser({
    email: 'public@example.com',
    name: 'Public Person',
  })

  const result = await setup.request(`/users/${user.id}`)

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    name: string | null
    roles: string[]
    confirmed_at: string | null
  }
  assert.equal(body.id, user.id)
  assert.equal(body.name, 'Public Person')
  assert.deepEqual(body.roles, ['user'])
  assert.ok(body.confirmed_at)
})
