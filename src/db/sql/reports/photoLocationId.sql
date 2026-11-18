SELECT o.location_id
FROM photos p
LEFT JOIN observations o ON o.id = p.observation_id
WHERE p.id = ${id}
