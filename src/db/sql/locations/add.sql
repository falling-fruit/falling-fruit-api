WITH l AS (
  INSERT INTO locations (
    lat,
    lng,
    type_ids,
    user_id,
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
    ${season_start},
    ${season_stop},
    ${access},
    ${description},
    ${unverified},
    ST_SetSrid(ST_MakePoint(${lng}, ${lat}), 4326)
  )
  RETURNING *
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
  l.invasive
FROM l
LEFT JOIN users u
  ON l.user_id = u.id
