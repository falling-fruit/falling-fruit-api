UPDATE users
SET (
  name,
  bio,
  range,
  announcements_email,
  updated_at
) = (
  ${name},
  ${bio},
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
  roles,
  created_at,
  updated_at,
  confirmed_at,
  unconfirmed_email
