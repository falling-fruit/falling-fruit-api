-- migrate:up
alter table public.types add column ja_name text;

-- migrate:down
alter table public.types drop column ja_name;
