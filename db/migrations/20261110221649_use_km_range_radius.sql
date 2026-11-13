-- migrate:up
UPDATE users
SET range_radius = range_radius * 1.60934
WHERE range_radius IS NOT NULL AND range_radius_unit = 'miles';
DROP COLUMN range_radius_unit FROM users;

-- migrate:down
SELECT 1/0;
