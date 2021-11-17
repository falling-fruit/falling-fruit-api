SELECT
  id, thumb, medium, original
FROM photos
WHERE observation_id = ${id}
ORDER BY id
