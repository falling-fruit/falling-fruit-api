SELECT
  id,
  lat,
  lng,
  type_ids,
  user_id,
  -- TEMP: Update author from current user name
  COALESCE(
    (SELECT name FROM users WHERE id = user_id),
    author
  ) AS author,
  import_id,
  season_start,
  season_stop,
  no_season,
  access,
  description,
  unverified,
  created_at,
  updated_at,
  address,
  city,
  state,
  country,
  muni,
  invasive
FROM locations
WHERE id = ${id}
