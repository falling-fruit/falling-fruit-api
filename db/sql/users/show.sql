SELECT
  id, email, name, roles,
  created_at, updated_at, confirmed_at
FROM users
WHERE id = ${id}
