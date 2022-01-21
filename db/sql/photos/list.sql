SELECT
  id, thumb, medium, original,
  created_at, updated_at
FROM photos
WHERE observation_id = ${id}
ORDER BY observation_order
