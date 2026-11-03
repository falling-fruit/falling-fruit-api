SELECT
  id, created_at, updated_at,
  url, name, comments, muni, license,
  location_count
FROM imports
  LEFT JOIN (
    SELECT import_id, COUNT(*) as location_count
    FROM locations
    WHERE import_id = ${id}
    GROUP BY import_id
  ) as l
  ON id = l.import_id
WHERE id = ${id}
