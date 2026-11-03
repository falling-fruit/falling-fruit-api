-- migrate:up
alter table public.users add column private boolean;
update public.users set private = name is null;
alter table public.users alter column private set not null;
alter table public.users alter column private set default false;

-- migrate:down
alter table public.users drop column private;
