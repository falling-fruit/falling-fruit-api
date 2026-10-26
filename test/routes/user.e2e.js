const test = require('node:test')
const assert = require('node:assert/strict')

const setup = require('../e2eSetup')({ tables: ['users'] })

test('signup with a new email creates a user and sends a confirmation email', async () => {
  const result = await setup.request('/user', {
    method: 'POST',
    body: { email: 'New.User@example.com', password: 'supersecret' }
  })

  assert.equal(result.status, 200)
  assert.deepEqual(setup.postmark.subjects(), ['Confirmation instructions'])

  const user = await setup.db.oneOrNone(
    'SELECT email FROM users WHERE email = ${email}',
    { email: 'new.user@example.com' }
  )
  assert.ok(user, 'user row should exist')
  assert.equal(user.email, 'new.user@example.com')
})

test('signup with an existing email does not create a duplicate', async () => {
  await setup.db.users.add({ body: { email: 'taken@example.com', password: 'supersecret' } })

  const result = await setup.request('/user', {
    method: 'POST',
    body: { email: 'Taken@example.com', password: 'anotherpass' }
  })

  assert.equal(result.status, 200)
  assert.deepEqual(setup.postmark.subjects(), ['Registration attempt'])

  const count = await setup.db.one(
    'SELECT COUNT(*)::int AS n FROM users WHERE email = ${email}',
    { email: 'taken@example.com' }
  )
  assert.equal(count.n, 1)
})
