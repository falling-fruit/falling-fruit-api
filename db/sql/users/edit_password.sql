UPDATE users
SET (
  name,
  bio,
  encrypted_password,
  range,
  announcements_email,
  updated_at
) = (
  ${name},
  ${bio},
  ${password},
  ST_GeomFromGeoJson(${range:json}),
  ${announcements_email},
  NOW()
)
WHERE id = ${id}
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
  confirmed_at,
  unconfirmed_email
