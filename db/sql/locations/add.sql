INSERT INTO locations (
  lat,
  lng,
  type_ids,
  user_id,
  author,
  season_start,
  season_stop,
  access,
  description,
  unverified,
  -- TODO: Remove once using generated column
  location
)
VALUES (
  ${lat},
  ${lng},
  ${type_ids},
  ${user_id},
  -- TEMP: Hardcode author from user name for old website
  (SELECT name FROM users WHERE id = ${user_id}),
  ${season_start},
  ${season_stop},
  ${access},
  ${description},
  ${unverified},
  ST_SetSrid(ST_MakePoint(${lng}, ${lat}), 4326)
)
RETURNING
  id,
  lat,
  lng,
  type_ids,
  user_id,
  author,
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
