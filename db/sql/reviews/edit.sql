UPDATE observations
SET (
  location_id, author,
  observed_on, comment,
  fruiting, quality_rating, yield_rating,
  updated_at
) = (
  ${location_id}, ${author},
  ${observed_on}, ${comment},
  ${fruiting}, ${quality_rating}, ${yield_rating},
  NOW()
)
WHERE id = ${id}
RETURNING
  id, location_id, user_id, author,
  created_at, updated_at, observed_on,
  comment, fruiting, quality_rating, yield_rating,
  photo_file_name
