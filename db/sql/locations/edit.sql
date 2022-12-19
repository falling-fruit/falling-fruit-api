UPDATE locations
SET (
  lat,
  lng,
  type_ids,
  season_start,
  season_stop,
  access,
  description,
  unverified,
  updated_at,
  -- TODO: Remove once using generated column
  location
) = (
  ${lat},
  ${lng},
  ${type_ids},
  ${season_start},
  ${season_stop},
  ${access},
  ${description},
  ${unverified},
  NOW(),
  ST_SetSrid(ST_MakePoint(${lng}, ${lat}), 4326)
)
WHERE id = ${id}
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
