import 'dotenv/config'
import makeDb from '../src/db'

if (process.env.NODE_ENV !== 'development') {
  throw new Error(
    'seed-dev refuses to run outside development (NODE_ENV must be "development")',
  )
}

const key = process.env.DEV_API_KEY
if (!key) {
  throw new Error('DEV_API_KEY must be set to seed a development API key')
}

const db = makeDb(process.env.DATABASE_URL)

const existing = await db.oneOrNone(
  'SELECT 1 FROM api_keys WHERE api_key = $<key>',
  { key },
)

if (!existing) {
  await db.none(
    `INSERT INTO api_keys (api_key, api_type, name)
     VALUES ($<key>, 'web', 'local-dev')`,
    { key },
  )
  console.log(`Seeded development API key "${key}"`)
}

await db.$pool.end()
