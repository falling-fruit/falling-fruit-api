import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: ['clusters', 'changes', 'locations', 'users', 'refresh_tokens'],
})

const CLUSTER_BOUNDS = '-80,-170|80,170'

async function countClusters(): Promise<number> {
  const result = await setup.request(`/clusters?bounds=${CLUSTER_BOUNDS}`)
  const body = result.body as { count: number }[]
  return body.reduce((total, cluster) => total + cluster.count, 0)
}

test('unhiding a location adds it back to clusters', async () => {
  const user = await setup.createUser({ email: 'user@example.com' })
  const location = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
    hidden: true,
  })
  assert.equal(await countClusters(), 0)

  const result = await setup.request(`/locations/${location.id}`, {
    method: 'PUT',
    headers: user.authHeaders,
    body: { lat: 40, lng: -88, type_ids: [1], hidden: false },
  })

  assert.equal(result.status, 200)
  const body = result.body as { hidden: boolean }
  assert.equal(body.hidden, false)
  assert.equal(await countClusters(), 1)
})
