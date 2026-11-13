-- migrate:up
UPDATE observations
SET comment = CASE
  WHEN comment IS NULL THEN photo_caption
  ELSE comment || 'Photo caption: \n\n' || photo_caption
  END
FROM observations
WHERE photo_caption IS NOT NULL;
DROP COLUMN photo_caption FROM observations;

-- migrate:down
SELECT 1/0;
