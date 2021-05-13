INSERT INTO users (
  email, name, add_anonymously,
  encrypted_password, authentication_token,
  created_at, updated_at
)
VALUES (
  ${email}, ${name}, ${add_anonymously},
  ${password}, ${token},
  NOW(), NOW()
)
RETURNING
  id, email,
  name, add_anonymously,
  created_at, updated_at
