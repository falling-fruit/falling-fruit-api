WITH lists AS (
  SELECT
    locations_routes.location_id,
    json_agg(
      json_build_object(
        'id', routes.id,
        'name', routes.name,
        'description', routes.description,
        'user_id', routes.user_id,
        'created_at', routes.created_at,
        'updated_at', routes.updated_at
      )
    ) AS lists
  FROM locations_routes
  JOIN routes ON routes.id = locations_routes.route_id
  WHERE routes.user_id = ${user_id} AND locations_routes.location_id = ${id}
  GROUP BY locations_routes.location_id
)
SELECT
  l.id,
  l.lat,
  l.lng,
  l.type_ids,
  l.user_id,
  CASE WHEN l.user_id IS NULL THEN l.author ELSE u.name END AS author,
  l.import_id,
  l.season_start,
  l.season_stop,
  l.no_season,
  l.access,
  l.description,
  l.unverified,
  l.created_at,
  l.updated_at,
  l.address,
  l.city,
  l.state,
  l.country,
  l.muni,
  l.invasive,
  coalesce(lists.lists, '[]'::json) AS lists
FROM locations l
LEFT JOIN users u
  ON l.user_id = u.id
LEFT JOIN lists
  ON lists.location_id = l.id
WHERE l.id = ${id}
