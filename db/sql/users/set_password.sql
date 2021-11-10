UPDATE users
SET (
  encrypted_password,
  reset_password_token, reset_password_sent_at,
  updated_at
) = (
  ${password},
  NULL, NULL,
  NOW()
)
WHERE id = ${id}
