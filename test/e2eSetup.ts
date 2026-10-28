import path from 'path'
import test from 'node:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') })

import makeDb = require('../src/db')
import createDependencies = require('../src/dependencies')
import createApp = require('../src/app')
import type { Db } from '../src/db/types'

const { createDependenciesForClients } = createDependencies

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const API_BASE = process.env.API_BASE || ''
const TEST_API_KEY = 'test-api-key'

type Email = { Subject: string; [key: string]: unknown }

class FakePostmarkClient {
  calls: Email[]

  constructor() {
    this.calls = []
  }

  sendEmail(email: Email) {
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

type S3Params = { Key: string; [key: string]: unknown }

class FakeS3Client {
  uploads: S3Params[]

  constructor() {
    this.uploads = []
  }

  upload(params: S3Params) {
    this.uploads.push(params)
    return {
      promise: () =>
        Promise.resolve({ Location: `https://example.com/${params.Key}` }),
    }
  }

  copyObject(_params: S3Params) {
    return { promise: () => Promise.resolve({}) }
  }

  reset() {
    this.uploads = []
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  apiKey?: string | null
}

type E2EResponse = {
  status: number
  body: unknown
  response: Response
}

class E2ESetup {
  tables: string[]
  db: Db
  postmark: FakePostmarkClient
  s3: FakeS3Client
  server: Server | null
  url: string | null

  constructor({ tables = [] }: { tables?: string[] } = {}) {
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
    this.server = await new Promise<Server>((resolve) => {
      const server = app.listen(0, () => resolve(server))
    })
    const { port } = this.server.address() as AddressInfo
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

  async request(
    pathname: string,
    {
      method = 'GET',
      body,
      headers = {},
      apiKey = TEST_API_KEY,
    }: RequestOptions = {},
  ): Promise<E2EResponse> {
    const url = `${this.url}${API_BASE}${pathname}`
    const finalHeaders: Record<string, string> = { ...headers }
    if (apiKey) {
      finalHeaders['x-api-key'] = apiKey
    }
    let payload: string | undefined
    if (body !== undefined) {
      finalHeaders['content-type'] =
        finalHeaders['content-type'] || 'application/json'
      payload = typeof body === 'string' ? body : JSON.stringify(body)
    }
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
    })
    const text = await response.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    return { status: response.status, body: parsed, response }
  }

  async close() {
    if (this.server) {
      const server = this.server
      await new Promise<void>((resolve) =>
        server.close(() => resolve()),
      )
      this.server = null
    }
    await this.db.$pool.end()
  }
}

function setupE2E(options: { tables?: string[] } = {}) {
  const setup = new E2ESetup(options)
  test.before(() => setup.start())
  test.beforeEach(() => setup.reset())
  test.after(() => setup.close())
  return setup
}

export = setupE2E
