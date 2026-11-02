-- migrate:up
alter table public.locations_routes add foreign key (route_id) references public.routes (id) on delete cascade;
alter table public.locations_routes add foreign key (location_id) references public.locations (id) on delete cascade;
alter table public.locations_routes add unique (route_id, location_id);
alter table public.locations_routes add unique (route_id, position);
alter table public.routes add foreign key (user_id) references public.users (id) on delete cascade;

-- migrate:down
alter table public.locations_routes drop constraint locations_routes_route_id_fkey;
alter table public.locations_routes drop constraint locations_routes_location_id_fkey;
alter table public.locations_routes drop constraint locations_routes_route_id_location_id_key;
alter table public.locations_routes drop constraint locations_routes_route_id_position_key;
alter table public.routes drop constraint routes_user_id_fkey;
