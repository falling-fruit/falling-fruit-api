SELECT
  c.created_at,
  c.description,
  c.location_id,
  c.observation_id AS review_id,
  l.type_ids,
  c.user_id,
  CASE WHEN u.private THEN null ELSE COALESCE(u.name, c.author) END AS author,
  l.lat,
  l.lng,
  l.city,
  l.state,
  l.country
FROM changes c
JOIN locations l
  ON c.location_id = l.id
LEFT JOIN users u
  ON c.user_id = u.id
WHERE ${where:raw}
ORDER BY c.created_at DESC
