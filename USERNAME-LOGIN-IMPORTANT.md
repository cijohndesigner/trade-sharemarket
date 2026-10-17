# Username + Password setup — important

The member-facing pages collect only a username and password. This package currently maps the username to a hidden synthetic identifier (`username@cjcruz.com`) because Supabase's built-in password authentication requires an email or phone identifier.

This means:
- Members do not enter an email on the website.
- No email confirmation should be required for this username-only test flow.
- Supabase Authentication > Users will still display the synthetic identifier. This cannot be removed while using Supabase's built-in email/password auth.
- The Email Auth provider must remain ENABLED for this implementation, even though the signup page has no email field. Keep Confirm email OFF for this setup.
- If you require absolutely no email-shaped identifier in Supabase, this needs a custom server-side authentication service (for example, a properly secured Edge Function/custom auth backend). It cannot be achieved securely by changing static HTML/JavaScript alone.

## Fix for the current “Email signups are disabled” message
1. Supabase Dashboard → Authentication → Sign In / Providers.
2. In Auth Providers, open Email and enable the Email provider.
3. Keep Confirm email OFF.
4. Save changes.
5. Use the existing username/password. Do not create duplicate accounts unnecessarily.

## Existing-account matching
`js/supabase-config.js` must retain:
`window.CJ_AUTH_EMAIL_DOMAIN = "cjcruz.com";`
This matches accounts such as `john@cjcruz.com` created by the current package. Do not change the domain after accounts exist unless you plan an account migration.

## Account approval
A user is allowed into the dashboard only when `public.member_access.status` is `approved`. New accounts should be `pending`. Admin approval UI requires the SQL in `SUPABASE-ADMIN-MEMBERS-SETUP.sql` and your own user UUID inserted into `public.app_admins`, as documented in `ADMIN-MEMBERS-SETUP.md`.

## Safety
- Never put a Supabase secret/service-role key in browser JavaScript.
- Do not store plaintext passwords.
- Do not publish for multi-member use until RLS is verified for trading records. Existing localStorage records are not automatically private cloud records.


## Existing account troubleshooting (important)
If an account was created while Confirm email was ON, turning Confirm email OFF later does not necessarily confirm that already-created user. In Supabase Authentication → Users, open the existing user and use the dashboard's confirmation action if available. Do not recreate the account. If no confirmation action is available, use a trusted server-side/admin process; never expose a service-role key in frontend code.
