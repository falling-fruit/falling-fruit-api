-- Requires intarray extension for idx()
SELECT
  id, observation_id, thumb, medium, original,
  created_at, updated_at
FROM photos
WHERE id IN (${ids:csv})
ORDER BY idx(ARRAY[${ids:csv}], id)
