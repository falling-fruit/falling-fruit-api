INSERT INTO locations (
  lat, lng, type_ids, user_id,
  season_start, season_stop,
  access, description, unverified
)
VALUES (
  ${lat}, ${lng}, ${type_ids}, ${user_id},
  ${season_start}, ${season_stop},
  ${access}, ${description}, ${unverified}
)
RETURNING
  id, lat, lng, type_ids, user_id,
  created_at, updated_at,
  address, city, state, country,
  season_start, season_stop,
  access,
  description,
  muni,
  unverified
