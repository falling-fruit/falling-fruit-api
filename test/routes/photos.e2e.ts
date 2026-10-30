import test from 'node:test'
import assert from 'node:assert/strict'

import sharp from 'sharp'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['photos', 'users', 'refresh_tokens'] })

const API_KEY = 'test-api-key'

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer()
}

async function uploadPhoto(headers: Record<string, string> = {}) {
  const buffer = await makeJpeg()
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg')
  const response = await fetch(`${setup.url}${setup.apiBase}/photos`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, ...headers },
    body: form,
  })
  const text = await response.text()
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null }
}

test('POST /photos uploads a photo and returns its urls', async () => {
  const result = await uploadPhoto()

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    thumb: string
    medium: string
    original: string
  }
  assert.ok(body.id)
  assert.ok(body.thumb)
  assert.ok(body.medium)
  assert.ok(body.original)

  const row = await setup.db.one<{ id: number }>(
    'SELECT id FROM photos WHERE id = ${id}',
    { id: body.id },
  )
  assert.equal(row.id, body.id)
})

test('POST /photos associates the photo with an authenticated user', async () => {
  const user = await setup.createUser({ email: 'photographer@example.com' })

  const result = await uploadPhoto(user.authHeaders)

  assert.equal(result.status, 200)
  const body = result.body as { id: number }
  const row = await setup.db.one<{ user_id: number | null }>(
    'SELECT user_id FROM photos WHERE id = ${id}',
    { id: body.id },
  )
  assert.equal(row.user_id, user.id)
})
