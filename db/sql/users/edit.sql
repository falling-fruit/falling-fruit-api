UPDATE users
SET (
  name,
  range,
  updated_at
) = (
  ${name},
  ST_GeomFromGeoJson(${range:json}),
  NOW()
)
WHERE id = ${id}
RETURNING
  id, email, name, roles,
  ST_AsGeoJson(range) as range,
  created_at, updated_at, confirmed_at,
  unconfirmed_email
