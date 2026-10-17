# CJ Cruz Trade Tracker — Admin Members Update

## Included
- `admin-members.html`: admin-only member list with a status dropdown and Save button.
- `js/admin-members.js`: checks the signed-in user's membership in `public.app_admins`, then reads profiles/access records and saves status changes.
- `SUPABASE-ADMIN-MEMBERS-SETUP.sql`: adds profile/admin tables and RLS policies for the admin page.
- Signup now writes the username/display name into `public.member_profiles` after Supabase returns a session.

The original trading HTML, calculation engines, SRB/FHSH pages, and JSON backup/restore files were not intentionally changed.

## Before testing

1. Keep your original project folder and ZIP as a backup.
2. Open Supabase > Authentication > Sign In / Providers.
3. Make sure the **Email provider is enabled**. Leave **Confirm email OFF** for this username-only synthetic-email approach. The UI does not ask members for an email, but Supabase still uses an internal identifier for its standard password authentication.
4. In Supabase > SQL Editor, inspect existing policies first. Run `SUPABASE-ADMIN-MEMBERS-SETUP.sql` only after reviewing them. This script does not replace or repair the existing `public.member_data` policies.
5. In Supabase > Authentication > Users, copy your own administrator account's UUID (not a password, key, or email).
6. In SQL Editor, run this statement after replacing the placeholder with your own UUID:

   ```sql
   insert into public.app_admins (user_id)
   values ('REPLACE_WITH_YOUR_AUTH_USER_UUID')
   on conflict (user_id) do nothing;
   ```

   Do not add ordinary members to `app_admins`.
7. Open `admin-members.html` in the same project after signing in with the administrator account. If using `file://` causes browser-origin or Supabase issues, test through a local static server instead.
8. Check the admin page can list members and save a test status. If it reports a policy error, stop and review Supabase Database > Policies; do not loosen policies broadly.
9. Existing users are backfilled from their stored Supabase user metadata, with the email prefix used only as a fallback. Review names in the admin list.

## Status behavior
- `pending`: waiting for approval; login denied.
- `approved`: access allowed.
- `rejected`: login denied.
- `suspended`: login denied.

The status dropdown saves to `public.member_access.status`. Existing login code treats every status other than `approved` as denied.

## Password reset
The admin page never displays passwords. For a manual reset, use Supabase Authentication > Users and the available password-management controls. If the provider/dashboard does not offer a direct password edit, use a trusted server-side admin process; never put a service-role/secret key into browser JavaScript.

## Important security note
The page guard is not the full security boundary. Supabase RLS policies are essential. This package does not migrate localStorage trading records into cloud storage, and it does not prove that all existing `public.member_data` policies are safe for multiple users. Before allowing other people to use the tracker, audit and test `member_data` policies and any existing broad policies on `member_access`. Keep service-role/secret keys out of the ZIP and GitHub.
