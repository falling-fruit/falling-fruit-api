SELECT
  p.created_at,
  COALESCE(p.problem_code, 5) AS problem_code
  ${columns:raw}
FROM problems p
WHERE p.location_id = ${location_id}
  AND p.resolution_code IS NULL
ORDER BY p.created_at ASC
