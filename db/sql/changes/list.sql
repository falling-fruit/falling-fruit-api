SELECT
  c.created_at,
  c.description,
  c.location_id,
  c.observation_id AS review_id,
  l.type_ids,
  c.user_id,
  COALESCE(c.author, u.name) AS author,
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
LIMIT ${limit}
OFFSET ${offset}
