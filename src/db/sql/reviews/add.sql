INSERT INTO observations (
  location_id,
  user_id,
  author,
  comment,
  quality_rating,
  yield_rating,
  fruiting,
  observed_on
)
SELECT
  l.id,
  ${user_id},
  -- TEMP: Hardcode author from user name for old website
  (SELECT name FROM users WHERE id = ${user_id}),
  ${comment},
  ${quality_rating},
  ${yield_rating},
  ${fruiting},
  ${observed_on}
FROM locations l
WHERE l.id = ${location_id}
  AND l.hidden IS NOT TRUE
RETURNING
  id,
  location_id,
  user_id,
  author,
  comment,
  quality_rating,
  yield_rating,
  fruiting,
  observed_on,
  created_at,
  updated_at
