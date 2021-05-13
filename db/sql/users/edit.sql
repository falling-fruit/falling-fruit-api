UPDATE users
SET (
  email, encrypted_password,
  name, add_anonymously,
  updated_at
) = (
  ${email}, ${password},
  ${name}, ${add_anonymously},
  NOW()
)
WHERE id = ${id}
RETURNING
  id, email,
  name, add_anonymously,
  created_at, updated_at
