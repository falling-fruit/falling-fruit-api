SELECT
  p.id,
  p.created_at,
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
    'user_id', p.reporter_id,
    'name', p.name,
    'email', p.email
  ) AS reporter
FROM problems p
LEFT JOIN locations l ON l.id = p.location_id
WHERE p.resolution_code IS NULL
ORDER BY p.created_at DESC
