SELECT
  o.id,
  o.location_id,
  o.user_id,
  CASE WHEN o.user_id IS NULL THEN o.author ELSE u.name END AS author,
  o.comment,
  o.quality_rating,
  o.yield_rating,
  o.fruiting,
  o.observed_on,
  o.created_at,
  o.updated_at
FROM observations o
LEFT JOIN users u
  ON o.user_id = u.id
WHERE o.id = ${id}
  AND (
    ${include_hidden}
    OR EXISTS (
      SELECT 1 FROM locations l
      WHERE l.id = o.location_id AND l.hidden IS NOT TRUE
    )
  )
