-- migrate:up
alter table public.types add column user_id integer references public.users (id) on delete set null;

-- migrate:down
alter table public.types drop column user_id;
