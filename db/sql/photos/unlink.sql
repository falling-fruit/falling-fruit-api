UPDATE photos
SET
  observation_id = null,
  observation_order = null
WHERE
  observation_id = ${id} AND
  -- Support empty ids
  NOT id = ANY(ARRAY[${ids:csv}]::integer[])
