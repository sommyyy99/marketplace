create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles as profiles (id, full_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'customer'
  )
  on conflict (id) do update
    set full_name = coalesce(profiles.full_name, excluded.full_name),
        role = coalesce(profiles.role, excluded.role);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles as profiles (id, full_name, role)
select
  users.id,
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
  'customer'
from auth.users
on conflict (id) do update
  set full_name = coalesce(profiles.full_name, excluded.full_name),
      role = coalesce(profiles.role, excluded.role);
