UPDATE observations
SET (
  comment,
  quality_rating,
  yield_rating,
  fruiting,
  observed_on,
  updated_at
) = (
  ${comment},
  ${quality_rating},
  ${yield_rating},
  ${fruiting},
  ${observed_on},
  NOW()
)
WHERE id = ${id}
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
