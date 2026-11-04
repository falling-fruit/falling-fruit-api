SELECT
  p.id,
  p.created_at,
  p.updated_at AS resolved_at,
  CASE
    WHEN l.id IS NULL THEN NULL
    ELSE json_build_object(
      'id', l.id,
      'lat', l.lat,
      'lng', l.lng,
      'type_ids', l.type_ids,
      'address', l.address
    )
  END AS location,
  COALESCE(p.problem_code, 5) AS problem_code,
  p.comment,
  json_build_object(
    'code', p.resolution_code,
    'response', p.response,
    'responder', json_build_object(
      'id', responder.id,
      'name', responder.name
    )
  ) AS resolution,
  json_build_object(
    'user_id', p.reporter_id,
    'name', p.name,
    'email', p.email
  ) AS reporter
FROM problems p
LEFT JOIN locations l ON l.id = p.location_id
LEFT JOIN users responder ON responder.id = p.responder_id
WHERE p.resolution_code IS NOT NULL
  AND (${problem_code} IS NULL OR p.problem_code = ${problem_code})
  AND (${resolution_code} IS NULL OR p.resolution_code = ${resolution_code})
  AND (
    ${search} IS NULL
    OR p.comment ILIKE ${search_like}
    OR p.response ILIKE ${search_like}
    OR p.name ILIKE ${search_like}
    OR p.email ILIKE ${search_like}
  )
ORDER BY p.updated_at ${sort_direction:raw}, p.id ${sort_direction:raw}
LIMIT ${limit}
OFFSET ${offset}
