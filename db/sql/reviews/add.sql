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
VALUES (
  ${location_id},
  ${user_id},
  -- TEMP: Hardcode author from user name for old website
  (SELECT name FROM users WHERE id = ${user_id}),
  ${comment},
  ${quality_rating},
  ${yield_rating},
  ${fruiting},
  ${observed_on}
)
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
