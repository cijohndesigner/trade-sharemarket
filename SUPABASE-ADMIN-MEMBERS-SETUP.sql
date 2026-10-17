-- CJ Cruz Trade Tracker: member profiles + admin approval dropdown.
-- IMPORTANT:
-- 1) Review existing RLS policies before running this migration.
-- 2) Do not disable RLS on member_access or member_data.
-- 3) Run this SQL, then add your own Supabase auth user UUID to app_admins
--    using the separate INSERT statement in the README. Never make all users admins.

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Backfill profile display names for accounts that already exist.
-- This uses stored user metadata first, then the part before @ as a fallback.
insert into public.member_profiles (user_id, username, full_name)
select
  u.id,
  left(coalesce(nullif(u.raw_user_meta_data->>'username',''), split_part(u.email, '@', 1)), 32),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    nullif(u.raw_user_meta_data->>'username',''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where u.email is not null
on conflict (user_id) do update
set username = coalesce(public.member_profiles.username, excluded.username),
    full_name = coalesce(public.member_profiles.full_name, excluded.full_name),
    updated_at = now();

alter table public.app_admins enable row level security;
alter table public.member_profiles enable row level security;
alter table public.member_access enable row level security;
alter table public.member_data enable row level security;

-- Security-definer helper avoids policy recursion when checking app_admins.
create or replace function public.is_cj_trade_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_cj_trade_admin() from public;
grant execute on function public.is_cj_trade_admin() to authenticated;

-- app_admins: signed-in users can only check their own admin membership.
drop policy if exists "Admin can view own admin record" on public.app_admins;
create policy "Admin can view own admin record"
on public.app_admins for select to authenticated
using (user_id = auth.uid());

-- Profiles: members can manage their own profile; admins can view all profiles.
drop policy if exists "Members can read own profile" on public.member_profiles;
create policy "Members can read own profile"
on public.member_profiles for select to authenticated
using (user_id = auth.uid() or public.is_cj_trade_admin());

drop policy if exists "Members can create own profile" on public.member_profiles;
create policy "Members can create own profile"
on public.member_profiles for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Members can update own profile" on public.member_profiles;
create policy "Members can update own profile"
on public.member_profiles for update to authenticated
using (user_id = auth.uid() or public.is_cj_trade_admin())
with check (user_id = auth.uid() or public.is_cj_trade_admin());

-- Member approval: members can see only their own status; admins can see and update all.
drop policy if exists "Members can read own access status" on public.member_access;
create policy "Members can read own access status"
on public.member_access for select to authenticated
using (user_id = auth.uid() or public.is_cj_trade_admin());

drop policy if exists "Members can request own pending access" on public.member_access;
create policy "Members can request own pending access"
on public.member_access for insert to authenticated
with check (user_id = auth.uid() and lower(status) = 'pending');

drop policy if exists "Admins can update member access" on public.member_access;
create policy "Admins can update member access"
on public.member_access for update to authenticated
using (public.is_cj_trade_admin())
with check (public.is_cj_trade_admin() and lower(status) in ('pending','approved','rejected','suspended'));

-- NOTE: This migration deliberately does not alter existing member_data policies.
-- Review Database > Policies for public.member_data separately before using shared accounts.
-- Existing broad policies on member_access/member_profiles should also be reviewed and removed
-- if they allow non-admin users to read/update other members' records.
