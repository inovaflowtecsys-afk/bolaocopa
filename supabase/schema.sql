create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  photo_url text not null default '',
  champion_prediction text not null default '',
  is_paid boolean not null default false,
  is_admin boolean not null default false,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  "group" text not null,
  date timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_score integer,
  away_score integer,
  location text,
  home_flag_url text,
  away_flag_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  home_score integer not null,
  away_score integer not null,
  points_earned integer not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bets_user_match_key unique (user_id, match_id)
);

create table if not exists public.settings (
  id integer primary key,
  bets_locked boolean not null default false,
  entry_fee numeric(10, 2) not null default 50,
  year text not null default '2026',
  logo_url text not null default 'https://thebrandinquirer.wordpress.com/wp-content/uploads/2023/05/cover-colors-fifa-unveils-official-logo-for-2026-world-cup-custom-cities.png?w=1024',
  prizes jsonb not null default '{"firstPlacePercent":50,"secondPlacePercent":20,"thirdPlacePercent":10,"championBonusPercent":20}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

drop trigger if exists set_bets_updated_at on public.bets;
create trigger set_bets_updated_at
before update on public.bets
for each row
execute function public.set_updated_at();

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    name,
    email,
    photo_url,
    champion_prediction,
    is_paid,
    is_admin,
    total_points
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'photo_url', ''),
    coalesce(new.raw_user_meta_data ->> 'champion_prediction', ''),
    coalesce((new.raw_user_meta_data ->> 'is_paid')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'is_admin')::boolean, false),
    0
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    photo_url = excluded.photo_url,
    champion_prediction = excluded.champion_prediction,
    is_paid = excluded.is_paid,
    is_admin = excluded.is_admin,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.settings enable row level security;

drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
on public.users
for select
to authenticated
using (true);

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users_update_admin" on public.users;
create policy "users_update_admin"
on public.users
for update
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "users_delete_admin" on public.users;
create policy "users_delete_admin"
on public.users
for delete
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "matches_select_public" on public.matches;
create policy "matches_select_public"
on public.matches
for select
to anon, authenticated
using (true);

drop policy if exists "matches_manage_admin" on public.matches;
create policy "matches_manage_admin"
on public.matches
for all
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "settings_select_public" on public.settings;
create policy "settings_select_public"
on public.settings
for select
to anon, authenticated
using (true);

drop policy if exists "settings_update_admin" on public.settings;
create policy "settings_update_admin"
on public.settings
for update
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "settings_insert_admin" on public.settings;
create policy "settings_insert_admin"
on public.settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "bets_select_owner_or_admin" on public.bets;
create policy "bets_select_owner_or_admin"
on public.bets
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "bets_insert_owner_or_admin" on public.bets;
create policy "bets_insert_owner_or_admin"
on public.bets
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "bets_update_owner_or_admin" on public.bets;
create policy "bets_update_owner_or_admin"
on public.bets
for update
to authenticated
using (
  (
    auth.uid() = user_id
    and is_locked = false
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
)
with check (
  (
    auth.uid() = user_id
    and is_locked = false
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);

drop policy if exists "bets_delete_admin" on public.bets;
create policy "bets_delete_admin"
on public.bets
for delete
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.id = auth.uid()
      and admin_user.is_admin = true
  )
);