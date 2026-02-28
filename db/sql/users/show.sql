SELECT
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
FROM users
WHERE id = ${id}
