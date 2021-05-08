SELECT id, COUNT(*)
FROM (
  SELECT unnest(type_ids) AS id
  FROM locations
  WHERE ${where:raw}
) subq
GROUP BY id
