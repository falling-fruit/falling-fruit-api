-- migrate:up
alter table public.routes add column description text;

-- migrate:down
alter table public.routes drop column description;
