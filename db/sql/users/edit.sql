UPDATE users
SET (
  name,
  updated_at
) = (
  ${name},
  NOW()
)
WHERE id = ${id}
RETURNING
  id, email, name, roles,
  created_at, updated_at, confirmed_at
