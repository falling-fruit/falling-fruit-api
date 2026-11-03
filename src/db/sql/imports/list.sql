SELECT
  id, created_at, updated_at,
  url, name, comments, muni, license,
  location_count
FROM imports
  LEFT JOIN (
    SELECT import_id, COUNT(*) as location_count
    FROM locations
    GROUP BY import_id
  ) as l
  ON id = l.import_id
ORDER BY created_at DESC
