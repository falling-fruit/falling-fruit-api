SELECT
  id, created_at, updated_at,
  url, name, comments, muni, license
FROM imports
ORDER BY created_at DESC
