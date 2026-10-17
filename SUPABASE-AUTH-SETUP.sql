-- CJ Cruz Trade Tracker: run in Supabase SQL Editor after reviewing existing policies.
-- Do NOT remove the existing member_data RLS policies.
-- Allow a signed-in user to create only their own pending access request.
-- If a policy with this name already exists, drop it first or choose a new name.
create policy "Members can request their own pending access"
on public.member_access
for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(status) = 'pending'
);

-- Keep RLS enabled on both tables. Verify it in Table Editor > each table > RLS.
alter table public.member_access enable row level security;
alter table public.member_data enable row level security;
