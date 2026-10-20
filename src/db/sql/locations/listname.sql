WITH locations AS (
  SELECT
    id,
    lng,
    lat,
    UNNEST(type_ids) as type_ids
  FROM public.locations
  WHERE ${where:raw}
  LIMIT ${limit}
  OFFSET ${offset}
)
SELECT
  locations.id,
  locations.lat,
  locations.lng,
  ARRAY_AGG(locations.type_ids) as type_ids,
  ARRAY_AGG(COALESCE(${names:raw})) AS type_names
  ${in_list:raw}
FROM locations, types
WHERE types.id = locations.type_ids
GROUP BY locations.id, locations.lat, locations.lng
