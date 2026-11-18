import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({
  tables: [
    'locations_routes',
    'routes',
    'observations',
    'photos',
    'problems',
    'clusters',
    'changes',
    'locations',
    'users',
    'refresh_tokens',
  ],
})

const CLUSTER_BOUNDS = '-80,-170|80,170'

async function countClusters(): Promise<number> {
  const result = await setup.request(`/clusters?bounds=${CLUSTER_BOUNDS}`)
  const body = result.body as { count: number }[]
  return body.reduce((total, cluster) => total + cluster.count, 0)
}

async function hide(id: number) {
  await setup.db.none('UPDATE locations SET hidden = true WHERE id = ${id}', {
    id,
  })
}

async function addHidden() {
  return setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
    hidden: true,
  })
}

test('unhiding a location adds it back to clusters', async () => {
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })
  const location = await addHidden()
  assert.equal(await countClusters(), 0)

  const result = await setup.request(`/locations/${location.id}`, {
    method: 'PUT',
    headers: admin.authHeaders,
    body: { hidden: false },
  })

  assert.equal(result.status, 200)
  const body = result.body as { hidden: boolean }
  assert.equal(body.hidden, false)
  assert.equal(await countClusters(), 1)
})

test('review endpoints treat a hidden location as not found for non-admins', async () => {
  const user = await setup.createUser({ email: 'user@example.com' })
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })
  const location = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  const review = await setup.db.reviews.add(location.id, {
    comment: 'Tasty.',
    user_id: user.id,
  })
  await hide(location.id)

  const list = await setup.request(`/locations/${location.id}/reviews`)
  assert.deepEqual(list.body, [])
  const adminList = await setup.request(`/locations/${location.id}/reviews`, {
    headers: admin.authHeaders,
  })
  assert.equal(adminList.status, 200)

  const create = await setup.request(`/locations/${location.id}/reviews`, {
    method: 'POST',
    headers: user.authHeaders,
    body: { comment: 'Hello.' },
  })
  assert.equal(create.status, 400)

  assert.equal((await setup.request(`/reviews/${review.id}`)).status, 404)
  assert.equal(
    (
      await setup.request(`/reviews/${review.id}`, {
        method: 'PUT',
        headers: user.authHeaders,
        body: { comment: 'Edited.' },
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await setup.request(`/reviews/${review.id}`, {
        method: 'DELETE',
        headers: user.authHeaders,
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await setup.request(`/reviews/${review.id}`, {
        headers: admin.authHeaders,
      })
    ).status,
    200,
  )
})

test('hidden locations are excluded from list by ids for non-admins', async () => {
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })
  const location = await addHidden()
  const url = `/locations?ids=${location.id}`

  const anonymous = await setup.request(url)
  assert.deepEqual(anonymous.body, [])
  const adminResult = await setup.request(url, { headers: admin.authHeaders })
  assert.equal((adminResult.body as unknown[]).length, 1)
})

test('hidden locations cannot be deleted by non-admins', async () => {
  const user = await setup.createUser({ email: 'user@example.com' })
  const location = await addHidden()

  const del = await setup.request(`/locations/${location.id}`, {
    method: 'DELETE',
    headers: user.authHeaders,
  })
  assert.equal(del.status, 400)
})

test('hidden locations are omitted from embedded location lists', async () => {
  const user = await setup.createUser({ email: 'user@example.com' })
  const visible = await setup.db.locations.add({
    lat: 41,
    lng: -88,
    type_ids: [1],
  })
  const hidden = await setup.db.locations.add({
    lat: 40,
    lng: -88,
    type_ids: [1],
  })
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: user.id },
  )
  await setup.db.locationLists.addLocationToList(visible.id, list.id)
  await setup.db.locationLists.addLocationToList(hidden.id, list.id)
  await hide(hidden.id)

  const one = await setup.request(`/locations/lists/${list.id}?embed=locations`, {
    headers: user.authHeaders,
  })
  const many = await setup.request('/locations/lists?embed=locations', {
    headers: user.authHeaders,
  })
  const oneBody = one.body as { locations: { id: number }[] }
  const manyBody = many.body as { locations: { id: number }[] }[]
  assert.deepEqual(oneBody.locations.map((l) => l.id), [visible.id])
  assert.deepEqual(manyBody[0].locations.map((l) => l.id), [visible.id])
})

test('hidden locations cannot be reviewed, reported, or added to lists, even by admins', async () => {
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })
  const location = await addHidden()
  const list = await setup.db.locationLists.addList(
    { name: 'Favorites' },
    { id: admin.id },
  )

  const review = await setup.request(`/locations/${location.id}/reviews`, {
    method: 'POST',
    headers: admin.authHeaders,
    body: { comment: 'Hello.' },
  })
  assert.equal(review.status, 400)

  const report = await setup.request('/reports', {
    method: 'POST',
    headers: admin.authHeaders,
    body: {
      location_id: location.id,
      problem_code: 1,
      email: 'admin@example.com',
    },
  })
  assert.equal(report.status, 400)

  const add = await setup.request(
    `/locations/${location.id}/lists/${list.id}`,
    { method: 'POST', headers: admin.authHeaders },
  )
  assert.equal(add.status, 404)
})

test('PUT /locations/:id cannot edit a hidden location other than to unhide it, even for admins', async () => {
  const admin = await setup.createUser({
    email: 'admin@example.com',
    roles: ['user', 'admin'],
  })
  const location = await addHidden()

  const edit = await setup.request(`/locations/${location.id}`, {
    method: 'PUT',
    headers: admin.authHeaders,
    body: { description: 'Edited.' },
  })
  assert.equal(edit.status, 400)

  const editWhileUnhiding = await setup.request(`/locations/${location.id}`, {
    method: 'PUT',
    headers: admin.authHeaders,
    body: { hidden: false, description: 'Edited.' },
  })
  assert.equal(editWhileUnhiding.status, 400)

  const stored = await setup.db.locations.show(location.id, null, true)
  assert.equal(stored.hidden, true)
  assert.equal(stored.description, null)
})
