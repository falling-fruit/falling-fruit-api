SELECT
  o.id, o.location_id, o.user_id,
  COALESCE(o.author, u.name) AS author,
  o.created_at, o.updated_at, o.observed_on,
  o.comment, o.fruiting, o.quality_rating, o.yield_rating
FROM observations o
LEFT JOIN users u
  ON o.user_id = u.id
WHERE o.id = ${id}
