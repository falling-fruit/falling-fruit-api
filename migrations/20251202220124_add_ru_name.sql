-- migrate:up
alter table public.types add column ru_name text;

-- migrate:down
alter table public.types drop column ru_name;
