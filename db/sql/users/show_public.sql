SELECT
  id,
  name,
  bio,
  private,
  roles,
  created_at,
  updated_at,
  confirmed_at
FROM users
WHERE id = ${id}
