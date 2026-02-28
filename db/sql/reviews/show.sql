SELECT
  o.id,
  o.location_id,
  o.user_id,
  CASE WHEN u.private THEN null ELSE COALESCE(u.name, o.author) END AS author,
  o.comment,
  o.quality_rating,
  o.yield_rating,
  o.fruiting,
  o.observed_on,
  o.created_at,
  o.updated_at
FROM observations o
LEFT JOIN users u
  ON o.user_id = u.id
WHERE o.id = ${id}
