INSERT INTO observations (
  location_id, author,
  observed_on, comment,
  fruiting, quality_rating, yield_rating,
  created_at, updated_at
)
VALUES (
  ${location_id}, ${author},
  ${observed_on}, ${comment},
  ${fruiting}, ${quality_rating}, ${yield_rating},
  NOW(), NOW()
)
RETURNING
  id, location_id, user_id, author,
  created_at, updated_at, observed_on,
  comment, fruiting, quality_rating, yield_rating,
  photo_file_name
