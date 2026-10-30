with dropped as (
  delete from locations_routes
  where
    location_id = ${location_id} and
    route_id = ${list_id}
  returning position
)
update locations_routes
set position = position - 1
where
  route_id = ${list_id} and
  position > (select position from dropped)
