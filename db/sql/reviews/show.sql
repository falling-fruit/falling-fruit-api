SELECT
  id, location_id, user_id,
  created_at, updated_at, observed_on,
  comment, fruiting, quality_rating, yield_rating,
  photo_file_name
FROM observations
WHERE id = ${id}
