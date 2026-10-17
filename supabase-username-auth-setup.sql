-- CJ Cruz username/password auth setup. Does not delete users or trading data.
-- Supabase Auth uses a hidden synthetic email identifier internally.
ALTER TABLE public.member_access ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS member_access_username_lower_unique
  ON public.member_access (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.member_access
  DROP CONSTRAINT IF EXISTS member_access_status_check;
ALTER TABLE public.member_access
  ADD CONSTRAINT member_access_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own approval status" ON public.member_access;
CREATE POLICY "Members can view own approval status"
  ON public.member_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can create own pending access request" ON public.member_access;
CREATE POLICY "Members can create own pending access request"
  ON public.member_access FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admin approval/rejection/suspension should be performed in the Supabase Dashboard.
-- Existing accounts without a username need their username filled in manually.
