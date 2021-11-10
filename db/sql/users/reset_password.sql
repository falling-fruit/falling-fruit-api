UPDATE users
SET (
  reset_password_token,
  reset_password_sent_at, updated_at
) = (
  ${token},
  NOW(), NOW()
)
WHERE id = ${id}
