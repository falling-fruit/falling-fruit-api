SELECT
  id,
  location_id,
  user_id,
  -- TEMP: Update author from current user name
  COALESCE(
    (SELECT name FROM users WHERE id = user_id),
    author
  ) AS author,
  comment,
  quality_rating,
  yield_rating,
  fruiting,
  observed_on,
  created_at,
  updated_at
FROM observations
WHERE id = ${id}
