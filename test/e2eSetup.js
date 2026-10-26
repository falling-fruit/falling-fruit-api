const path = require('path')
const test = require('node:test')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') })

const makeDb = require('../src/db')
const createDependencies = require('../src/dependencies')
const { createDependenciesForClients } = createDependencies
const createApp = require('../src/app')

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const API_BASE = process.env.API_BASE || ''
const TEST_API_KEY = 'test-api-key'

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

  reset() {
    this.calls = []
  }
}

class FakeS3Client {
  constructor() {
    this.uploads = []
  }

  upload(params) {
    this.uploads.push(params)
    return {
      promise: () => Promise.resolve({ Location: `https://example.com/${params.Key}` })
    }
  }

  copyObject(params) {
    return { promise: () => Promise.resolve({}) }
  }

  reset() {
    this.uploads = []
  }
}

class E2ESetup {
  constructor({ tables = [] } = {}) {
    this.tables = tables
    this.db = makeDb(process.env.DB, false)
    this.postmark = new FakePostmarkClient()
    this.s3 = new FakeS3Client()
    this.server = null
    this.url = null
  }

  async start() {
    const { middleware, routes } = createDependenciesForClients(
      {
        local: true,
        jwtSecret: JWT_SECRET,
      },
      {
        db: this.db,
        postmarkClient: this.postmark,
        s3Client: this.s3,
        recaptcha: null,
      },
    )
    const app = createApp({ middleware, routes, apiBase: API_BASE })
    await this.reset()
    this.server = await new Promise((resolve) => {
      const server = app.listen(0, () => resolve(server))
    })
    const { port } = this.server.address()
    this.url = `http://localhost:${port}`
    return this
  }

  async reset() {
    this.postmark.reset()
    this.s3.reset()
    const tables = ['api_keys', ...this.tables]
    await this.db.none(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
    await this.db.none(
      'INSERT INTO api_keys (api_key, api_type, name) VALUES (${key}, ${type}, ${name})',
      { key: TEST_API_KEY, type: 'web', name: 'e2e' }
    )
  }

  async request(pathname, { method = 'GET', body, headers = {}, apiKey = TEST_API_KEY } = {}) {
    const url = `${this.url}${API_BASE}${pathname}`
    const finalHeaders = { ...headers }
    if (apiKey) {
      finalHeaders['x-api-key'] = apiKey
    }
    let payload
    if (body !== undefined) {
      finalHeaders['content-type'] = finalHeaders['content-type'] || 'application/json'
      payload = typeof body === 'string' ? body : JSON.stringify(body)
    }
    const response = await fetch(url, { method, headers: finalHeaders, body: payload })
    const text = await response.text()
    let parsed = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    return { status: response.status, body: parsed, response }
  }

  async close() {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve))
      this.server = null
    }
    await this.db.$pool.end()
  }
}

function setupE2E(options = {}) {
  const setup = new E2ESetup(options)
  test.before(() => setup.start())
  test.beforeEach(() => setup.reset())
  test.after(() => setup.close())
  return setup
}

module.exports = setupE2E
