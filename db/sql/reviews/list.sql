WITH o AS (
  SELECT
    o.id,
    o.location_id,
    o.user_id,
    o.author,
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
  GROUP BY o.id
)
SELECT
  o.*,
  CASE WHEN u.private THEN null ELSE COALESCE(u.name, o.author) END AS author
FROM o
LEFT JOIN users u
  ON o.user_id = u.id
