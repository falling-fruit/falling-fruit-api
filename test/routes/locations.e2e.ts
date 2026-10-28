import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E = require('../e2eSetup')

const setup = setupE2E({ tables: ['locations'] })

const POINT = [40.1125785, -88.2287926]

test('an empty database has no locations around the point', async () => {
  const locations = await setup.db.locations.list({ center: POINT }, null)

  assert.ok(Array.isArray(locations))
  assert.equal(locations.length, 0)
})
