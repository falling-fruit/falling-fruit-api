import type { Db } from './types'

export async function seedApiKey(
  db: Db,
  { key, type, name }: { key: string; type: string; name: string },
): Promise<void> {
  await db.none(
    'INSERT INTO api_keys (api_key, api_type, name) VALUES (${key}, ${type}, ${name})',
    { key, type, name },
  )
}

export async function seedUser(
  db: Db,
  {
    email,
    password,
    name,
    roles,
    confirmed,
  }: {
    email: string
    password: string
    name: string | null
    roles: string[]
    confirmed: boolean
  },
): Promise<{ id: number }> {
  const user = await db.users.add({ body: { email, password, name } })
  const rolesMask = roles.includes('admin') ? 11 : 10
  await db.none('UPDATE users SET roles_mask = ${rolesMask} WHERE id = ${id}', {
    id: user.id,
    rolesMask,
  })
  if (confirmed) {
    await db.users.confirm(user.id)
  }
  return { id: user.id }
}
