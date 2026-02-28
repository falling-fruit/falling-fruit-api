INSERT INTO users (
  email,
  encrypted_password,
  name,
  bio,
  range,
  announcements_email,
  private
)
VALUES (
  ${email},
  ${password},
  ${name},
  ${bio},
  ST_GeomFromGeoJson(${range:json}),
  ${announcements_email},
  ${private}
)
RETURNING
  id,
  email,
  name,
  bio,
  ST_AsGeoJson(range) as range,
  announcements_email,
  private,
  roles,
  created_at,
  updated_at,
  confirmed_at
