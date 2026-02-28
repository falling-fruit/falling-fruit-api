WITH l AS (
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
  RETURNING *
)
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
FROM l
LEFT JOIN users u
  ON l.user_id = u.id
