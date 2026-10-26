const test = require('node:test')
const assert = require('node:assert/strict')

const setup = require('../e2eSetup')({ tables: ['locations']})

const POINT = '40.1125785,-88.2287926'

test('an empty database has no locations around the point', async () => {
  const locations = await setup.db.locations.list({ center: POINT })

  assert.ok(Array.isArray(locations))
  assert.equal(locations.length, 0)
})
