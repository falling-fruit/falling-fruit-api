SELECT id, lng, lat, type_ids
FROM locations
WHERE ${bounds:raw} AND muni ${muni:raw} AND type_ids ${types:raw} AND NOT hidden
LIMIT 1000
