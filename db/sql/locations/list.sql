SELECT id, lng, lat, type_ids ${distance.column:raw}
FROM locations
WHERE
  location && ${bounds:raw} AND
  muni ${muni:raw} AND
  type_ids ${types:raw} AND
  NOT hidden
${distance.order:raw}
LIMIT ${limit}
OFFSET ${offset}
