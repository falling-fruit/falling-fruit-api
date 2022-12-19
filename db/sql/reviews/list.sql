SELECT
  o.id,
  o.location_id,
  o.user_id,
  -- TEMP: Update author from current user name
  COALESCE(
    (SELECT name FROM users WHERE id = o.user_id),
    o.author
  ) AS author,
  o.created_at,
  o.updated_at,
  o.observed_on,
  o.comment,
  o.fruiting,
  o.quality_rating,
  o.yield_rating,
  COALESCE(
    json_agg(
      json_build_object(
        'id', p.id,
        'thumb', p.thumb,
        'medium', p.medium,
        'original', p.original,
        'created_at', p.created_at,
        'updated_at', p.updated_at
      )
      ORDER BY p.observation_order
    )
    FILTER (WHERE p.id IS NOT NULL),
    '[]'
  ) AS photos
FROM observations o
LEFT JOIN photos p
  ON o.id = p.observation_id
WHERE o.location_id = ${id}
GROUP BY o.id;
