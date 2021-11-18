UPDATE photos
SET
  observation_id = ${id},
  observation_order = temp.row_number
FROM (
  SELECT
    id, row_number() OVER (ORDER BY idx(ARRAY[${ids:csv}], id)) AS row_number
  FROM photos
  WHERE id IN (${ids:csv})
) temp
WHERE temp.id = photos.id
