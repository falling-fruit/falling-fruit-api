INSERT INTO problems (
  location_id,
  reporter_id,
  name,
  email,
  problem_code,
  comment
)
SELECT
  ${location_id},
  ${reporter_id},
  ${name},
  ${email},
  ${problem_code},
  ${comment}
WHERE ${location_id} IS NULL
  OR EXISTS (
    SELECT 1 FROM locations l
    WHERE l.id = ${location_id} AND l.hidden IS NOT TRUE
  )
RETURNING
  id,
  location_id,
  reporter_id,
  name,
  email,
  problem_code,
  comment,
  created_at,
  updated_at,
  resolution_code,
  response,
  responder_id
