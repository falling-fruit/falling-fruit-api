update routes
set (
  name,
  description,
  updated_at
) = (
  ${name},
  ${description},
  now()
)
where id = ${id}
returning
  id,
  name,
  description,
  user_id,
  created_at,
  updated_at
