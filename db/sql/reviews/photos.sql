SELECT
  COALESCE(
    json_agg(json_build_object('thumb', p.thumb, 'medium', p.medium, 'original', p.original))
    FILTER (WHERE p.id IS NOT NULL), '[]'
  ) AS photos
FROM observations o
LEFT JOIN photos p
  ON o.id = p.observation_id
WHERE o.id = ${id}
