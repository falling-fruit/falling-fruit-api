INSERT INTO users (
  email, encrypted_password, name,
  range,
  created_at, updated_at
)
VALUES (
  ${email}, ${password}, ${name},
  ST_GeomFromGeoJson(${range:json}),
  NOW(), NOW()
)
RETURNING
  id, email, name, roles,
  created_at, updated_at, confirmed_at
