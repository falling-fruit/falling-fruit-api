-- migrate:up
-- Test that original_ids is empty if inaturalist_id is not null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM locations
    WHERE inaturalist_id IS NOT NULL AND original_ids <> '{}'
  ) THEN
      RAISE EXCEPTION 'rows with non-null original_ids and inaturalist_id';
  END IF;
END $$;
UPDATE locations
SET original_ids = ARRAY[inaturalist_id::text]
WHERE inaturalist_id IS NOT NULL;
DROP COLUMN inaturalist_id FROM locations;

-- migrate:down
SELECT 1/0;

