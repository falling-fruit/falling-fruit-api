WITH o AS (
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
  RETURNING *
)
SELECT
  o.id,
  o.location_id,
  o.user_id,
  CASE WHEN u.private THEN null ELSE COALESCE(u.name, o.author) END AS author,
  o.comment,
  o.quality_rating,
  o.yield_rating,
  o.fruiting,
  o.observed_on,
  o.created_at,
  o.updated_at
FROM o
LEFT JOIN users u
  ON o.user_id = u.id
