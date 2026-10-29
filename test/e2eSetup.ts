import path from 'path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') })

import makeDb from '../src/db'
import createDependencies from '../src/dependencies'
import createApp from '../src/app'
import Tokenizer from '../src/tokens'
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
    const body = params.Body as NodeJS.ReadableStream | undefined
    const drained = body
      ? new Promise<void>((resolve, reject) => {
          body.on('data', () => {})
          body.on('end', () => resolve())
          body.on('error', reject)
        })
      : Promise.resolve()
    return {
      promise: () =>
        drained.then(() => ({
          Location: `https://example.com/${params.Key}`,
        })),
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
  tables: Set<string>
  db: Db
  postmark: FakePostmarkClient
  s3: FakeS3Client
  tokenizer: Tokenizer
  server: Server | null
  url: string | null
  apiBase: string
  private starting: Promise<E2ESetup> | null

  constructor() {
    this.tables = new Set()
    this.db = makeDb(process.env.DB, false)
    this.postmark = new FakePostmarkClient()
    this.s3 = new FakeS3Client()
    this.tokenizer = new Tokenizer(JWT_SECRET)
    this.server = null
    this.url = null
    this.apiBase = API_BASE
    this.starting = null
  }

  registerTables(tables: string[]) {
    for (const table of tables) {
      this.tables.add(table)
    }
  }

  async start() {
    if (this.server) {
      return this
    }
    if (this.starting) {
      return this.starting
    }
    this.starting = this.doStart()
    return this.starting
  }

  private async doStart() {
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

  async createUser({
    email = 'user@example.com',
    password = 'supersecret',
    name = 'Test User',
    roles = ['user'],
    confirmed = true,
  }: {
    email?: string
    password?: string
    name?: string | null
    roles?: string[]
    confirmed?: boolean
  } = {}): Promise<{
    id: number
    email: string
    password: string
    roles: string[]
    token: string
    authHeaders: Record<string, string>
  }> {
    const user = await this.db.users.add({
      body: { email: email.toLowerCase(), password, name },
    })
    const rolesMask = roles.includes('admin') ? 11 : 10
    await this.db.none(
      'UPDATE users SET roles_mask = ${rolesMask} WHERE id = ${id}',
      { id: user.id, rolesMask },
    )
    if (confirmed) {
      await this.db.users.confirm(user.id)
    }
    const token = await this.signAccessToken({ id: user.id, roles })
    return {
      id: user.id,
      email: email.toLowerCase(),
      password,
      roles,
      token,
      authHeaders: { authorization: `Bearer ${token}` },
    }
  }

  async signAccessToken(user: {
    id: number
    roles?: string[]
  }): Promise<string> {
    const [tokens, jti, exp] = this.tokenizer.sign_and_wrap_access(user)
    await this.db.none(
      'INSERT INTO refresh_tokens (user_id, jti, exp) VALUES (${user_id}, ${jti}, ${exp})',
      { user_id: user.id, jti, exp },
    )
    return tokens.access_token
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
    this.starting = null
  }
}

let sharedSetup: E2ESetup | null = null
let activeFiles = 0

function getSharedSetup(): E2ESetup {
  if (!sharedSetup) {
    sharedSetup = new E2ESetup()
  }
  return sharedSetup
}

function setupE2E(options: { tables?: string[] } = {}) {
  const setup = getSharedSetup()
  setup.registerTables(options.tables ?? [])

  test.before(async () => {
    activeFiles += 1
    await setup.start()
  })
  test.beforeEach(() => setup.reset())
  test.after(async () => {
    activeFiles -= 1
    if (activeFiles === 0) {
      await setup.close()
      sharedSetup = null
    }
  })

  return setup
}

export default setupE2E
