-- migrate:up
DELETE FROM observations WHERE graft IS true;
DELETE FROM changes WHERE description = 'grafted';

-- migrate:down
SELECT 1/0;
