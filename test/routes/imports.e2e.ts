import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['imports', 'locations'] })

async function seedImport(name: string) {
  const row = await setup.db.one<{ id: number }>(
    `INSERT INTO imports (name, url, comments, muni, license)
     VALUES (\${name}, \${url}, \${comments}, \${muni}, \${license})
     RETURNING id`,
    {
      name,
      url: 'http://example.com/data',
      comments: 'A dataset',
      muni: true,
      license: 'ODbL',
    },
  )
  return row.id
}

test('GET /imports lists imports with location counts', async () => {
  const importId = await seedImport('Grenoble trees')
  await setup.db.none(
    `INSERT INTO locations (lat, lng, type_ids, import_id, location)
     VALUES (1, 2, ARRAY[1], \${import_id},
       ST_SetSRID(ST_MakePoint(2, 1), 4326))`,
    { import_id: importId },
  )

  const result = await setup.request('/imports')

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    name: string
    muni: boolean
    location_count: number
  }[]
  assert.equal(body.length, 1)
  assert.equal(body[0].id, importId)
  assert.equal(body[0].name, 'Grenoble trees')
  assert.equal(body[0].muni, true)
  assert.equal(body[0].location_count, 1)
})

test('GET /imports/:id fetches a single import', async () => {
  const importId = await seedImport('Boulder trees')

  const result = await setup.request(`/imports/${importId}`)

  assert.equal(result.status, 200)
  const body = result.body as {
    id: number
    name: string
    url: string | null
    license: string | null
  }
  assert.equal(body.id, importId)
  assert.equal(body.name, 'Boulder trees')
  assert.equal(body.url, 'http://example.com/data')
  assert.equal(body.license, 'ODbL')
})
