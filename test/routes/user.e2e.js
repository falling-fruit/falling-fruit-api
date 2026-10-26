process.env.RECAPTCHA_DISABLED = 'true'

const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

const { E2ESetup } = require('../e2eSetup')
const Tokenizer = require('../../src/tokens')
const makeMiddleware = require('../../src/middleware')

const setup = new E2ESetup()
const { db } = setup

class FakeMailer {
  constructor() {
    this.calls = []
  }

  record(name) {
    return (...args) => {
      this.calls.push({ name, args })
      return Promise.resolve()
    }
  }

  send_email_confirmation = this.record('send_email_confirmation')
  send_email_confirmation_exists = this.record('send_email_confirmation_exists')
  send_email_confirmation_not_found = this.record('send_email_confirmation_not_found')
  send_email_confirmation_confirmed = this.record('send_email_confirmation_confirmed')
  send_password_reset = this.record('send_password_reset')
  send_password_reset_not_found = this.record('send_password_reset_not_found')

  names() {
    return this.calls.map((call) => call.name)
  }
}

function startApp(mailer) {
  const tokenizer = new Tokenizer()
  const middleware = makeMiddleware({ db, tokenizer })
  const router = require('../../src/routes/user')({ mailer, db, tokenizer, middleware })
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use('/user', router)
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
  const mailer = new FakeMailer()
  const { server, url } = await startApp(mailer)
  try {
    const { status } = await signup(url, {
      email: 'New.User@example.com',
      password: 'supersecret'
    })

    assert.equal(status, 200)
    assert.deepEqual(mailer.names(), ['send_email_confirmation'])

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
  const mailer = new FakeMailer()
  const { server, url } = await startApp(mailer)
  try {
    await db.users.add({ body: { email: 'taken@example.com', password: 'supersecret' } })

    const { status } = await signup(url, {
      email: 'Taken@example.com',
      password: 'anotherpass'
    })

    assert.equal(status, 200)
    assert.deepEqual(mailer.names(), ['send_email_confirmation_exists'])

    const count = await db.one(
      'SELECT COUNT(*)::int AS n FROM users WHERE email = ${email}',
      { email: 'taken@example.com' }
    )
    assert.equal(count.n, 1)
  } finally {
    server.close()
  }
})
