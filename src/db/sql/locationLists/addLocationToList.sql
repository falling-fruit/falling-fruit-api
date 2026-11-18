with loc as (
  select id
  from locations
  where id = ${location_id}
    and hidden is not true
),
ins as (
  insert into locations_routes (
    location_id,
    route_id,
    position,
    created_at,
    updated_at
  )
  select
    loc.id,
    ${list_id},
    (
      select coalesce(max(position) + 1, 0)
      from locations_routes
      where route_id = ${list_id}
    ),
    now(),
    now()
  from loc
  on conflict do nothing
)
select exists (select 1 from loc) as found
