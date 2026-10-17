# CJ Cruz Trade Tracker — Auth Integration Package

## What changed
- `index.html` now opens the glass sign-in screen.
- The original dashboard was preserved as `dashboard.html`.
- Added Supabase username/password sign-in and signup wiring.
- Added an approval check for `member_access.status = approved`.
- Added a sign-out control to the dashboard title bar.
- Added an auth guard to the existing trading pages.
- Existing trading modules and JSON backup/restore code were retained.
- `SUPABASE-AUTH-SETUP.sql` contains the additional pending-request insert policy.

## Required setup before publishing
1. Open `js/supabase-config.js`.
2. Replace `PASTE_YOUR_COMPLETE_SB_PUBLISHABLE_KEY_HERE` with the full `sb_publishable_...` key from Supabase > Settings > API Keys. Never use an `sb_secret_...` key in browser code.
3. In Supabase Authentication settings, disable email confirmations for this username-only setup. These accounts use a synthetic internal email (`username@cjcruz.com`) because Supabase password sign-in requires an email or phone identifier. Phone/SMS is not used.
4. Run `SUPABASE-AUTH-SETUP.sql` in Supabase SQL Editor. If the policy name already exists, review/drop the duplicate first. Keep RLS enabled.
5. Confirm `member_access` has `user_id` (UUID) and `status` columns. The administrator must change a member's status to `approved` to allow access.
6. Test signup and login with a non-sensitive test account before inviting anyone.

## Important limitations — please read
- **Username-only password recovery cannot send a reset link** because there is no real email address or phone number. The forgot-password page tells members to contact the administrator. To enable self-service recovery, add a verified recovery email or implement a secure server-side recovery flow.
- This package gates pages and checks approval, but your existing trading modules still primarily use browser `localStorage`. That data is not automatically synced to Supabase and does not become per-user cloud data just by adding login. Before treating the app as multi-user/private cloud storage, migrate records to `member_data` and verify row-level security for every operation.
- GitHub Pages is static hosting. Never put Supabase secret/service-role keys in the repository.
- The browser page guard is not a substitute for database RLS. Sensitive data must be protected by Supabase policies.
- Existing `member_data` INSERT policy shown in your project appears to require an already-approved user. Do not weaken it broadly. Signup inserts only a `pending` row into `member_access`; test the exact policy against your project before production.
- External CDN fonts, Bootstrap, Font Awesome, and Supabase JS need internet access.

## Rollback
Keep the original ZIP as a backup. To revert, restore the original `index.html` and remove the added auth scripts from the trading pages.


## Admin approval dropdown update
See `ADMIN-MEMBERS-SETUP.md` and `SUPABASE-ADMIN-MEMBERS-SETUP.sql` for the separate admin member-management page. Do not run SQL until existing RLS policies have been reviewed.
