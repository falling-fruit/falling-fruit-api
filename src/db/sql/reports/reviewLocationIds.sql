SELECT id, location_id
FROM observations
WHERE id IN (${ids:csv})
