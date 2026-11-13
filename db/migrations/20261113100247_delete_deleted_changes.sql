-- migrate:up
DELETE FROM changes WHERE description = '1 location deleted';

-- migrate:down
SELECT 1/0;
