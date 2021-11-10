INSERT INTO users (
  email, encrypted_password, name,
  created_at, updated_at
)
VALUES (
  ${email}, ${password}, ${name},
  NOW(), NOW()
)
RETURNING
  id, email, name, roles,
  created_at, updated_at, confirmed_at
