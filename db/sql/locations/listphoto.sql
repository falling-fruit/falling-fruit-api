SELECT DISTINCT ON (locations.id)
  locations.id, lng, lat, type_ids ${distance.column:raw},
  o.id as review_id, o.photo_file_name
FROM locations
  LEFT JOIN observations o
  ON o.location_id = locations.id
  AND o.photo_file_name IS NOT NULL
WHERE ${where:raw}
${distance.order:raw}
LIMIT ${limit}
OFFSET ${offset}
