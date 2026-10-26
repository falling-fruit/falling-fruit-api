const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

const { E2ESetup } = require('../e2eSetup')
const createDependencies = require('../../src/dependencies')

const setup = new E2ESetup()
const { db } = setup

class FakePostmarkClient {
  constructor() {
    this.calls = []
  }

  sendEmail(email) {
    this.calls.push(email)
    return Promise.resolve()
  }

  subjects() {
    return this.calls.map((email) => email.Subject)
  }
}

function startApp(postmarkClient) {
  const { routes } = createDependencies({
    db,
    jwtSecret: process.env.JWT_SECRET,
    postmarkClient,
    s3Client: {},
    recaptcha: null
  })
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use('/user', routes.user)
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({ server, url: `http://localhost:${port}` })
    })
  })
}

async function signup(url, body) {
  const response = await fetch(`${url}/user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: response.status, body: await response.json() }
}

setup.register(() => setup.reset('users'))

test('signup with a new email creates a user and sends a confirmation email', async () => {
  const client = new FakePostmarkClient()
  const { server, url } = await startApp(client)
  try {
    const { status } = await signup(url, {
      email: 'New.User@example.com',
      password: 'supersecret'
    })

    assert.equal(status, 200)
    assert.deepEqual(client.subjects(), ['Confirmation instructions'])

    const user = await db.oneOrNone(
      'SELECT email FROM users WHERE email = ${email}',
      { email: 'new.user@example.com' }
    )
    assert.ok(user, 'user row should exist')
    assert.equal(user.email, 'new.user@example.com')
  } finally {
    server.close()
  }
})

test('signup with an existing email does not create a duplicate', async () => {
  const client = new FakePostmarkClient()
  const { server, url } = await startApp(client)
  try {
    await db.users.add({ body: { email: 'taken@example.com', password: 'supersecret' } })

    const { status } = await signup(url, {
      email: 'Taken@example.com',
      password: 'anotherpass'
    })

    assert.equal(status, 200)
    assert.deepEqual(client.subjects(), ['Registration attempt'])

    const count = await db.one(
      'SELECT COUNT(*)::int AS n FROM users WHERE email = ${email}',
      { email: 'taken@example.com' }
    )
    assert.equal(count.n, 1)
  } finally {
    server.close()
  }
})
