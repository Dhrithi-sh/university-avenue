create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null check (char_length(display_name) between 1 and 120),
  slug text not null unique check (char_length(slug) between 1 and 100),
  bio text not null default '' check (char_length(bio) <= 2000),
  avatar_url text,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_status_idx on public.profiles (role, status);

create or replace function public.profile_slug(p_display_name text, p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(coalesce(p_display_name, '')), '[^a-z0-9]+', '-', 'g')), ''),
      'contributor'
    ),
    80
  ) || '-' || left(p_user_id::text, 8)
$$;

revoke all on function public.profile_slug(text, uuid) from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  )
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 120), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 120), ''),
    'Contributor'
  );

  insert into public.profiles (id, email, display_name, slug, role, status)
  values (
    new.id,
    new.email,
    profile_name,
    public.profile_slug(profile_name, new.id),
    'contributor',
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

-- Backfill existing Auth users without changing any pre-existing profile or role.
insert into public.profiles (id, email, display_name, slug, role, status)
select
  u.id,
  u.email,
  profile.display_name,
  public.profile_slug(profile.display_name, u.id),
  'contributor',
  'active'
from auth.users u
cross join lateral (
  select coalesce(
    nullif(left(btrim(u.raw_user_meta_data ->> 'display_name'), 120), ''),
    nullif(left(split_part(coalesce(u.email, ''), '@', 1), 120), ''),
    'Contributor'
  ) as display_name
) profile
on conflict (id) do nothing;

create or replace function public.prevent_profile_privilege_self_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception using errcode = '42501', message = 'Profile IDs cannot be changed';
  end if;

  if auth.uid() = old.id and not public.is_admin() then
    if new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.status is distinct from old.status then
      raise exception using errcode = '42501', message = 'You cannot change protected profile fields';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_profile_privilege_self_change() from public, anon, authenticated;

drop trigger if exists profiles_prevent_privilege_self_change on public.profiles;
create trigger profiles_prevent_privilege_self_change
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_self_change();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, slug, bio, avatar_url) on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Users can update their permitted profile fields" on public.profiles;
create policy "Users can update their permitted profile fields"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.set_profile_access(
  target_user_id uuid,
  target_role text,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  if target_role is null or target_role not in ('contributor', 'admin') then
    raise exception using errcode = '22023', message = 'Invalid profile role';
  end if;

  if target_status is null or target_status not in ('active', 'suspended') then
    raise exception using errcode = '22023', message = 'Invalid profile status';
  end if;

  update public.profiles
  set role = target_role,
      status = target_status
  where id = target_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;
end;
$$;

revoke all on function public.set_profile_access(uuid, text, text) from public, anon;
grant execute on function public.set_profile_access(uuid, text, text) to authenticated;
