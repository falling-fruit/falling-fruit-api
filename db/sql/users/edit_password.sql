UPDATE users
SET (
  name,
  encrypted_password,
  updated_at
) = (
  ${name},
  ${password},
  NOW()
)
WHERE id = ${id}
RETURNING
  id, email, name, roles,
  created_at, updated_at, confirmed_at,
  unconfirmed_email
