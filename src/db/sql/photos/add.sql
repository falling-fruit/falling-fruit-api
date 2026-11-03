INSERT INTO photos (
  thumb, medium, original,
  user_id
)
VALUES (
  ${thumb}, ${medium}, ${original},
  ${user_id}
)
RETURNING
  id, thumb, medium, original,
  created_at, updated_at
