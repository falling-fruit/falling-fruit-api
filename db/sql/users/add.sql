INSERT INTO users (
  email, encrypted_password, name, bio,
  range,
  created_at, updated_at
)
VALUES (
  ${email}, ${password}, ${name}, ${bio},
  ST_GeomFromGeoJson(${range:json}),
  NOW(), NOW()
)
RETURNING
  id, email, name, bio, roles,
  created_at, updated_at, confirmed_at
