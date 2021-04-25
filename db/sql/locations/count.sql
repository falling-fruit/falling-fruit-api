SELECT COUNT(*)
FROM locations
WHERE
  location && ${bounds:raw} AND
  muni ${muni:raw} AND
  type_ids ${types:raw} AND
  NOT hidden
