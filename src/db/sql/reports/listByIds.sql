SELECT
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
FROM problems
WHERE id IN (${ids:csv})
