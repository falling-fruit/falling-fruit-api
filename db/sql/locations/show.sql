SELECT
  id, lat, lng, type_ids,
  created_at, updated_at,
  address, city, state, country,
  season_start, season_stop, no_season,
  access,
  description,
  muni,
  unverified
FROM locations
WHERE id = ${id}
