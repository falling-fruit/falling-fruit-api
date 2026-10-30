insert into locations_routes (
  location_id,
  route_id,
  position,
  created_at,
  updated_at
)
values (
  ${location_id},
  ${list_id},
  (
    select coalesce(max(position) + 1, 0)
    from locations_routes
    where route_id = ${list_id}
  ),
  now(),
  now()
)
on conflict do nothing
