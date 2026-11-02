-- migrate:up
alter table public.types add column cs_name text;

-- migrate:down
alter table public.types drop column cs_name;
