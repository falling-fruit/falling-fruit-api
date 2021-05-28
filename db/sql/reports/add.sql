INSERT INTO problems (
  location_id, reporter_id, name, email,
  problem_code, comment,
  created_at, updated_at
)
VALUES (
  ${location_id}, ${reporter_id}, ${name}, ${email},
  ${problem_code}, ${comment},
  NOW(), NOW()
)
RETURNING
  id, location_id, reporter_id, name, email,
  problem_code, comment,
  created_at, updated_at,
  resolution_code, response, responder_id
