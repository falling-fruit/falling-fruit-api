SELECT
  locations.id, lng, lat, type_ids ${distance.column:raw},
  o.id as review_id, o.photo_file_name
FROM locations
  LEFT JOIN (
    SELECT DISTINCT ON (location_id)
      id, location_id, photo_file_name
    FROM observations WHERE photo_file_name IS NOT NULL
    ORDER BY location_id, created_at DESC
  ) as o
  ON o.location_id = locations.id
WHERE ${where:raw}
${distance.order:raw}
LIMIT ${limit}
OFFSET ${offset}
