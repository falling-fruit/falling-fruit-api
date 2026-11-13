-- migrate:up
DELETE FROM changes WHERE description ~ 'new locations imported';

-- migrate:down
SELECT 1/0;
