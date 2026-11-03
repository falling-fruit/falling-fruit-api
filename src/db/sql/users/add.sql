INSERT INTO users (
  email,
  encrypted_password,
  name,
  bio,
  range,
  announcements_email
)
VALUES (
  ${email},
  ${password},
  ${name},
  ${bio},
  ST_GeomFromGeoJson(${range:json}),
  ${announcements_email}
)
RETURNING
  id,
  email,
  name,
  bio,
  ST_AsGeoJson(range) as range,
  announcements_email,
  roles,
  created_at,
  updated_at,
  confirmed_at
