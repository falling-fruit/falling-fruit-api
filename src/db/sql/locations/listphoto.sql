SELECT
  locations.id,
  lng,
  lat,
  type_ids ${distance.column:raw},
  j.thumb as photo
  ${in_list:raw}
FROM locations
  LEFT JOIN (
    SELECT DISTINCT ON (o.location_id)
      o.location_id, p.thumb
    FROM observations o
    INNER JOIN photos p
    ON o.id = p.observation_id
    ORDER BY o.location_id, p.id DESC
  ) as j
ON locations.id = j.location_id
WHERE ${where:raw}
${distance.order:raw}
LIMIT ${limit}
OFFSET ${offset}
