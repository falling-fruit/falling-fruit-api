UPDATE locations
SET (
  lat, lng, type_ids,
  season_start, season_stop,
  access, description, unverified,
  updated_at
) = (
  ${lat}, ${lng}, ${type_ids},
  ${season_start}, ${season_stop},
  ${access}, ${description}, ${unverified},
  NOW()
)
WHERE id = ${id}
RETURNING
  id, lat, lng, type_ids, user_id,
  created_at, updated_at,
  address, city, state, country,
  season_start, season_stop,
  access,
  description,
  muni,
  unverified
