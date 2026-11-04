UPDATE problems
SET
  resolution_code = ${resolution_code},
  response = ${response},
  responder_id = ${responder_id},
  updated_at = now()
WHERE id IN (${ids:csv})
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
