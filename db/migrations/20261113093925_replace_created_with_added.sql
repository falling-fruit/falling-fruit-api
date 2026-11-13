-- migrate:up
UPDATE changes
SET description = 'added'
WHERE description = 'created';

-- migrate:down
SELECT 1/0;
