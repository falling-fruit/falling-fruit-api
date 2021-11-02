SELECT
  o.id, o.location_id, o.user_id,
  COALESCE(o.author, u.name) AS author,
  o.created_at, o.updated_at, o.observed_on,
  o.comment, o.fruiting, o.quality_rating, o.yield_rating,
  COALESCE(
    json_agg(json_build_object('thumb', p.thumb, 'medium', p.medium, 'original', p.original))
    FILTER (WHERE p.id IS NOT NULL), '[]'
  ) AS photos
FROM observations o
LEFT JOIN users u
  ON o.user_id = u.id
LEFT JOIN photos p
  ON o.id = p.observation_id
WHERE o.location_id = ${id}
GROUP BY o.id, u.name
