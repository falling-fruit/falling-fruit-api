SELECT id, lng, lat, type_ids ${distance.column:raw}
FROM locations
WHERE ${where:raw}
${distance.order:raw}
LIMIT ${limit}
OFFSET ${offset}
