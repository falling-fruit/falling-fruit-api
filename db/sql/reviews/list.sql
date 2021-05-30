SELECT
  o.id, o.location_id, o.user_id,
  COALESCE(o.author, u.name) as author,
  o.created_at, o.updated_at, o.observed_on,
  o.comment, o.fruiting, o.quality_rating, o.yield_rating,
  o.photo_file_name
FROM observations o
LEFT JOIN users u
  ON o.user_id = u.id
WHERE o.location_id = ${id}
