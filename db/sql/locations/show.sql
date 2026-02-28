SELECT
  l.id,
  l.lat,
  l.lng,
  l.type_ids,
  l.user_id,
  CASE WHEN u.private THEN null ELSE COALESCE(u.name, l.author) END AS author,
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
  l.invasive
FROM locations l
LEFT JOIN users u
  ON l.user_id = u.id
WHERE l.id = ${id}
