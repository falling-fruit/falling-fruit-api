DELETE FROM observations
WHERE id IN (${ids:csv})
