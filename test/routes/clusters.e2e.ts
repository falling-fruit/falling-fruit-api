import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['clusters'] })

test('GET /clusters returns clusters within bounds', async () => {
  await setup.db.clusters.increment({ lng: 10, lat: 20, type_ids: [1] })

  const result = await setup.request('/clusters?bounds=-80,-170|80,170')

  assert.equal(result.status, 200)
  const body = result.body as { lat: number; lng: number; count: number }[]
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 1)
  assert.equal(body[0].count, 1)
  assert.ok(Math.abs(body[0].lat - 20) < 1)
  assert.ok(Math.abs(body[0].lng - 10) < 1)
})

test('GET /clusters returns an empty array when no clusters match', async () => {
  const result = await setup.request('/clusters?bounds=-80,-170|80,170')

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, [])
})

test('GET /clusters with an empty types filter returns an empty array', async () => {
  await setup.db.clusters.increment({ lng: 10, lat: 20, type_ids: [1] })

  const result = await setup.request(
    '/clusters?bounds=-80,-170|80,170&types=',
  )

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, [])
})
