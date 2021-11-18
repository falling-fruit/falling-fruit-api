WITH l AS (
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
    id, lat, lng, type_ids, user_id, import_id, author,
    created_at, updated_at,
    address, city, state, country,
    season_start, season_stop, no_season,
    access,
    description,
    muni,
    unverified
)
SELECT
  l.id, l.lat, l.lng, l.type_ids, l.import_id, l.user_id,
  COALESCE(l.author, u.name) as author,
  l.created_at, l.updated_at,
  l.address, l.city, l.state, l.country,
  l.season_start, l.season_stop, l.no_season,
  l.access,
  l.description,
  l.muni,
  l.unverified,
  l.invasive
FROM l
LEFT JOIN users u
  ON l.user_id = u.id
