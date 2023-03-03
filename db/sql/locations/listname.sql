WITH temp AS (
  SELECT id, lng, lat, UNNEST(type_ids) as type_ids
  FROM locations
  WHERE ${where:raw}
  LIMIT ${limit}
  OFFSET ${offset}
)
SELECT
  temp.id,
  temp.lat,
  temp.lng,
  ARRAY_AGG(temp.type_ids) as type_ids,
  ARRAY_AGG(COALESCE(${names:raw})) AS type_names
FROM temp, types
WHERE types.id = temp.type_ids
GROUP BY temp.id, temp.lat, temp.lng
