WITH o AS (
  UPDATE observations
  SET (
    observed_on, comment,
    fruiting, quality_rating, yield_rating,
    updated_at
  ) = (
    ${observed_on}, ${comment},
    ${fruiting}, ${quality_rating}, ${yield_rating},
    NOW()
  )
  WHERE id = ${id}
  RETURNING
    id, location_id, user_id, author,
    created_at, updated_at, observed_on,
    comment, fruiting, quality_rating, yield_rating
)
SELECT
  o.id, o.location_id, o.user_id,
  COALESCE(o.author, u.name) AS author,
  o.created_at, o.updated_at, o.observed_on,
  o.comment, o.fruiting, o.quality_rating, o.yield_rating
FROM o
LEFT JOIN users u
  ON o.user_id = u.id
