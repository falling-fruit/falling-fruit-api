INSERT INTO users (
  email,
  encrypted_password,
  name,
  bio,
  range
)
VALUES (
  ${email},
  ${password},
  ${name},
  ${bio},
  ST_GeomFromGeoJson(${range:json})
)
RETURNING
  id,
  email,
  name,
  bio,
  roles,
  created_at,
  updated_at,
  confirmed_at
