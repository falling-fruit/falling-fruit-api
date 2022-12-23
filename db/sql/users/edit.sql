UPDATE users
SET (
  name,
  bio,
  range,
  updated_at
) = (
  ${name},
  ${bio},
  ST_GeomFromGeoJson(${range:json}),
  NOW()
)
WHERE id = ${id}
RETURNING
  id,
  email,
  name,
  bio,
  roles,
  ST_AsGeoJson(range) as range,
  created_at,
  updated_at,
  confirmed_at,
  unconfirmed_email
