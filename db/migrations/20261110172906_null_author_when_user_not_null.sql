-- migrate:up
UPDATE locations SET author = NULL WHERE user_id IS NOT NULL;
UPDATE reviews SET author = NULL WHERE user_id IS NOT NULL;

-- migrate:down
-- Impossible as user.name may no longer match the original author
SELECT 1/0;
