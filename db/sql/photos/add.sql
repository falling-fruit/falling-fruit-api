INSERT INTO photos (
  thumb, medium, original
)
VALUES (
  ${thumb}, ${medium}, ${original}
)
RETURNING
  id, thumb, medium, original
