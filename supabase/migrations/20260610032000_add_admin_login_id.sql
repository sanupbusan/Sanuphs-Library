alter table public.admin_users
  add column if not exists login_id text;

with ranked_admins as (
  select
    user_id,
    row_number() over (order by created_at, user_id) as row_number
  from public.admin_users
  where login_id is null
)
update public.admin_users
set login_id = case
  when ranked_admins.row_number = 1 then 'SanupLib'
  else 'admin-' || replace(public.admin_users.user_id::text, '-', '')
end
from ranked_admins
where public.admin_users.user_id = ranked_admins.user_id;

alter table public.admin_users
  alter column login_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_login_id_key'
  ) then
    alter table public.admin_users
      add constraint admin_users_login_id_key unique (login_id);
  end if;
end $$;
