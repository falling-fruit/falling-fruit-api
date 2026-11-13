-- migrate:up
-- api_keys
DROP COLUMN version FROM api_keys;
-- changes
DROP COLUMN former_type_others FROM changes;
DROP COLUMN spam FROM changes;
-- imports
DROP COLUMN autoload FROM imports;
DROP COLUMN auto_cluster FROM imports;
-- locations
DROP COLUMN client FROM locations;
-- observations
DROP COLUMN photo_file_name FROM observations;
DROP COLUMN photo_content_type FROM observations;
DROP COLUMN photo_file_size FROM observations;
DROP COLUMN photo_updated_at FROM observations;
DROP COLUMN remote_ip FROM observations;
DROP COLUMN graft FROM observations;
-- routes
DROP COLUMN is_public FROM routes;
DROP COLUMN access_key FROM routes;
DROP COLUMN transport_type FROM routes;
DROP COLUMN description FROM routes;
-- sessions
DROP TABLE sessions;
-- users
DROP COLUMN reset_password_token FROM users;
DROP COLUMN reset_password_sent_at FROM users;
DROP COLUMN remember_created_at FROM users;
DROP COLUMN sign_in_count FROM users;
DROP COLUMN current_sign_in_at FROM users;
DROP COLUMN last_sign_in_at FROM users;
DROP COLUMN current_sign_in_ip FROM users;
DROP COLUMN last_sign_in_ip FROM users;
DROP COLUMN confirmation_token FROM users;
DROP COLUMN confirmation_sent_at FROM users;
DROP COLUMN authentication_token FROM users;
DROP COLUMN location FROM users;
DROP COLUMN roles_mask FROM users;
DROP COLUMN add_anonymously FROM users;
DROP COLUMN private FROM users;
-- functions & triggers
DROP TRIGGER add_observation_photo_trigger ON observations;
DROP FUNCTION add_observation_photo();
DROP FUNCTION st_buffer_meters();
DROP FUNCTION utmzone();

-- migrate:down
SELECT 1/0;
