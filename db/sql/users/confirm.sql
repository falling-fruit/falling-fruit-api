UPDATE users
SET (
  confirmed_at,
  updated_at
) = (
  NOW(),
  NOW()
)
WHERE id = ${id}
