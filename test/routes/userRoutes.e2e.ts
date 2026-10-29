import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['users', 'refresh_tokens'] })

function formBody(fields: Record<string, string>): {
  body: string
  headers: Record<string, string>
} {
  return {
    body: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }
}

// Routes: Users (private)

test('GET /user returns the authenticated user', async () => {
  const user = await setup.createUser({ email: 'self@example.com' })

  const result = await setup.request('/user', { headers: user.authHeaders })

  assert.equal(result.status, 200)
  const body = result.body as { id: number; email: string }
  assert.equal(body.id, user.id)
  assert.equal(body.email, 'self@example.com')
})

test('GET /user requires a token', async () => {
  const result = await setup.request('/user')

  assert.equal(result.status, 403)
  assert.deepEqual(result.body, { error: 'Token is required but missing' })
})

test('PUT /user edits the authenticated user', async () => {
  const user = await setup.createUser({ email: 'self@example.com' })

  const result = await setup.request('/user', {
    method: 'PUT',
    body: {
      email: 'self@example.com',
      name: 'New Name',
      bio: 'New bio',
      range: null,
      announcements_email: false,
    },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 200)
  const body = result.body as { name: string; announcements_email: boolean }
  assert.equal(body.name, 'New Name')
  assert.equal(body.announcements_email, false)
})

test('PUT /user requires the current password to change email', async () => {
  const user = await setup.createUser({ email: 'self@example.com' })

  const result = await setup.request('/user', {
    method: 'PUT',
    body: {
      email: 'changed@example.com',
      name: 'Name',
      bio: null,
      range: null,
      announcements_email: true,
    },
    headers: user.authHeaders,
  })

  assert.equal(result.status, 401)
  assert.deepEqual(result.body, {
    error: 'Current password is required to change email or password',
  })
})

test('DELETE /user deletes the authenticated user', async () => {
  const user = await setup.createUser({ email: 'self@example.com' })

  const result = await setup.request('/user', {
    method: 'DELETE',
    headers: user.authHeaders,
  })

  assert.equal(result.status, 204)
  const row = await setup.db.oneOrNone(
    'SELECT id FROM users WHERE id = ${id}',
    { id: user.id },
  )
  assert.equal(row, null)
})

// Routes: Access tokens

test('POST /user/token issues an access token for valid credentials', async () => {
  await setup.createUser({
    email: 'login@example.com',
    password: 'supersecret',
  })

  const result = await setup.request(
    '/user/token',
    {
      method: 'POST',
      ...formBody({ username: 'login@example.com', password: 'supersecret' }),
    },
  )

  assert.equal(result.status, 200)
  const body = result.body as {
    access_token: string
    token_type: string
    refresh_token: string
  }
  assert.equal(body.token_type, 'bearer')
  assert.ok(body.access_token)
  assert.ok(body.refresh_token)
})

test('POST /user/token rejects an invalid password', async () => {
  await setup.createUser({
    email: 'login@example.com',
    password: 'supersecret',
  })

  const result = await setup.request('/user/token', {
    method: 'POST',
    ...formBody({ username: 'login@example.com', password: 'wrongpass' }),
  })

  assert.equal(result.status, 401)
  assert.deepEqual(result.body, { error: 'Invalid email or password' })
})

test('POST /user/token rejects an unconfirmed account', async () => {
  await setup.createUser({
    email: 'pending@example.com',
    password: 'supersecret',
    confirmed: false,
  })

  const result = await setup.request('/user/token', {
    method: 'POST',
    ...formBody({ username: 'pending@example.com', password: 'supersecret' }),
  })

  assert.equal(result.status, 400)
  assert.deepEqual(result.body, {
    error: 'You have to confirm your email address before continuing',
  })
})

test('POST /user/token/refresh exchanges a refresh token for a new access token', async () => {
  await setup.createUser({
    email: 'login@example.com',
    password: 'supersecret',
  })

  const tokenResult = await setup.request('/user/token', {
    method: 'POST',
    ...formBody({ username: 'login@example.com', password: 'supersecret' }),
  })
  const { refresh_token } = tokenResult.body as { refresh_token: string }

  const result = await setup.request('/user/token/refresh', {
    method: 'POST',
    ...formBody({ grant_type: 'refresh_token', refresh_token }),
  })

  assert.equal(result.status, 200)
  const body = result.body as { access_token: string; token_type: string }
  assert.equal(body.token_type, 'bearer')
  assert.ok(body.access_token)
})

// Routes: Email confirmation

test('POST /user/confirmation confirms an unconfirmed account', async () => {
  const added = await setup.db.users.add({
    body: { email: 'confirm@example.com', password: 'supersecret' },
  })
  const token = setup.tokenizer.sign_email_confirmation({ id: added.id })

  const result = await setup.request('/user/confirmation', {
    method: 'POST',
    body: { token },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { email: 'confirm@example.com' })

  const row = await setup.db.one<{ confirmed_at: string | null }>(
    'SELECT confirmed_at FROM users WHERE id = ${id}',
    { id: added.id },
  )
  assert.ok(row.confirmed_at)
})

test('GET /user/confirmation confirms via a link token', async () => {
  const added = await setup.db.users.add({
    body: { email: 'confirmlink@example.com', password: 'supersecret' },
  })
  const token = setup.tokenizer.sign_email_confirmation({ id: added.id })

  const result = await setup.request(
    `/user/confirmation?token=${encodeURIComponent(token)}`,
  )

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    message: 'Your email address has been successfully confirmed',
  })
})

test('POST /user/confirmation/retry resends confirmation instructions', async () => {
  await setup.db.users.add({
    body: { email: 'retry@example.com', password: 'supersecret' },
  })

  const result = await setup.request('/user/confirmation/retry', {
    method: 'POST',
    body: { email: 'retry@example.com' },
  })

  assert.equal(result.status, 200)
  const body = result.body as { message: string }
  assert.ok(body.message)
  assert.deepEqual(setup.postmark.subjects(), ['Confirmation instructions'])
})

// Routes: Password

test('POST /user/password/reset sends a reset email to a known user', async () => {
  await setup.createUser({ email: 'resetme@example.com' })

  const result = await setup.request('/user/password/reset', {
    method: 'POST',
    body: { email: 'resetme@example.com' },
  })

  assert.equal(result.status, 200)
  const body = result.body as { message: string }
  assert.ok(body.message)
  assert.deepEqual(setup.postmark.subjects(), ['Reset password instructions'])
})

test('PUT /user/password sets a new password with a valid token', async () => {
  const user = await setup.createUser({
    email: 'pwreset@example.com',
    password: 'oldsecret',
  })
  const row = await setup.db.one<{ encrypted_password: string }>(
    'SELECT encrypted_password FROM users WHERE id = ${id}',
    { id: user.id },
  )
  const token = setup.tokenizer.sign_password_reset(
    { id: user.id },
    row.encrypted_password,
  )

  const result = await setup.request('/user/password', {
    method: 'PUT',
    body: { token, password: 'newsecret' },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { email: 'pwreset@example.com' })

  const login = await setup.request('/user/token', {
    method: 'POST',
    ...formBody({ username: 'pwreset@example.com', password: 'newsecret' }),
  })
  assert.equal(login.status, 200)
})
