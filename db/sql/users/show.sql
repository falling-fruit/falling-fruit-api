SELECT
  id, email, name, bio, roles,
  ST_AsGeoJson(range) as range,
  created_at, updated_at, confirmed_at
FROM users
WHERE id = ${id}