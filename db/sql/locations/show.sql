SELECT
  l.id, l.lat, l.lng, l.type_ids, l.user_id, l.import_id,
  COALESCE(l.author, u.name) as author,
  l.created_at, l.updated_at,
  l.address, l.city, l.state, l.country,
  l.season_start, l.season_stop, l.no_season,
  l.access,
  l.description,
  l.muni,
  l.unverified
FROM locations l
LEFT JOIN users u
  ON l.user_id = u.id
WHERE l.id = ${id}
