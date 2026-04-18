insert into routes (
  name,
  description,
  user_id,
  created_at,
  updated_at
)
values (
  ${name},
  ${description},
  ${user_id},
  now(),
  now()
)
returning
  id,
  name,
  description,
  user_id,
  created_at,
  updated_at
