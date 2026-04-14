with lists as (
  select
    locations_routes.route_id as id,
    json_agg(
      json_build_object(
        'id', locations.id,
        'added_at', locations_routes.created_at,
        'lat', locations.lat,
        'lng', locations.lng,
        'type_ids', locations.type_ids,
        'address', locations.address
      ) order by locations_routes.position
    ) as locations
  from locations_routes
  left join locations on locations.id = locations_routes.location_id
  where locations_routes.route_id = ${id}
  group by locations_routes.route_id
)
select
  routes.id,
  routes.name,
  routes.description,
  routes.user_id,
  routes.created_at,
  routes.updated_at,
  lists.locations
from routes
left join lists on lists.id = routes.id
where routes.id = ${id}
