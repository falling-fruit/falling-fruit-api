UPDATE users
SET (
  encrypted_password,
  updated_at
) = (
  ${password},
  NOW()
)
WHERE id = ${id}
