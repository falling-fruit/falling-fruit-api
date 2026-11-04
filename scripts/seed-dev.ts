import 'dotenv/config'
import makeDb from '../src/db'
import { seedApiKey, seedUser } from '../src/db/seed'

if (process.env.NODE_ENV !== 'development') {
  throw new Error(
    'seed-dev refuses to run outside development (NODE_ENV must be "development")',
  )
}

const key = process.env.DEV_API_KEY
if (!key) {
  throw new Error('DEV_API_KEY must be set to seed a development API key')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to seed the development database')
}

const db = makeDb(databaseUrl, false)

const existingKey = await db.oneOrNone<{ exists: boolean }>(
  'SELECT EXISTS (SELECT 1 FROM api_keys WHERE api_key = ${key}) AS exists',
  { key },
)
if (!existingKey?.exists) {
  await seedApiKey(db, { key, type: 'web', name: 'local-dev' })
  console.log(`Seeded development API key "${key}"`)
}

const users = [
  { email: 'admin@fallingfruit.org', name: 'Admin', roles: ['admin', 'user'] },
  { email: 'user@fallingfruit.org', name: 'User', roles: ['user'] },
]

for (const { email, name, roles } of users) {
  const existingUser = await db.oneOrNone<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM users WHERE email = ${email}) AS exists',
    { email },
  )
  if (existingUser?.exists) {
    continue
  }
  await seedUser(db, { email, password: 'password', name, roles, confirmed: true })
  console.log(`Seeded development user "${email}" (${roles.join(', ')})`)
}

await db.$pool.end()
