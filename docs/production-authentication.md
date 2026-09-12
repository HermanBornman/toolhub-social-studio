# Production authentication and user security

## Boundary

Supabase Auth owns passwords, reset tokens and email delivery. The Next.js server uses the official Supabase JavaScript SDK. No provider tokens, service-role key or role claims are sent to client components. Toolhub looks up the verified Supabase user ID in its existing User table; email is never an automatic account-linking mechanism. Roles and active status always come from Toolhub.

The browser holds a random 256-bit opaque session secret in an HttpOnly SameSite=Lax cookie (Secure with __Host- prefix in production, Path=/, no Domain). Only its SHA-256 digest is stored. Provider access/refresh tokens are encrypted using AES-256-GCM with a server-managed 32-byte key. App sessions expire absolutely after 12 hours; provider access tokens refresh as necessary without extending that deadline. Every private request verifies provider identity and reloads local role/active status. Logout deletes the local session before best-effort provider revocation. Deactivation deletes every local session immediately. A provider outage denies access.

All private pages call requirePageUser before fetching business data and redirect unauthenticated users to /login. Every private API uses withAuthorization independently, returns 401/403 and disables caching. Mutations require an exact Origin match with configured APP_URL, including login, logout and reset. There is no environment-driven identity fallback, including AUTH_MODE=dev. Tests inject a mock provider inside the test process only.

## Server configuration

Use Node.js 22 or newer (required by the selected Supabase SDK). The package manifest declares this minimum.

Set AUTH_MODE=supabase, APP_URL to the exact deployed HTTPS origin, SUPABASE_URL to the existing project URL and SUPABASE_ANON_KEY to its publishable/anon key. Keep SUPABASE_SERVICE_ROLE_KEY server-only for existing storage and the operator onboarding command; normal sign-in does not use it.

Generate AUTH_ENCRYPTION_KEY using node crypto randomBytes(32).toString('hex') and place it in the server secret store. Do not commit, log or send it in chat. Rotation invalidates existing encrypted sessions: revoke AuthSession rows during a planned maintenance window, rotate the key, then require fresh sign-in. Back up encryption keys separately from database backups. Keep all instances on the same key and shared persistent database. SQLite requires a durable single-host deployment; it is not a distributed database.

AUTH_MODE unset, unknown or dev fails closed. Old TOOLHUB_USER_ROLE/ID/NAME values do not authenticate anyone. Normal seed never creates identities. Demo seeding is explicitly non-production and does not link provider identities.

## Supabase dashboard setup (operator action, not performed automatically)

1. Enable email/password authentication. Disable **Allow new users to sign up**, anonymous sign-ins and unused social providers. Require confirmed email. Configure provider password policy (minimum 12 characters recommended), rate limits and abuse protection.
2. Set Site URL to APP_URL. Allow only the exact APP_URL/auth/confirm redirect, plus explicitly needed local test origins. Do not use wildcard production redirects.
3. Configure custom SMTP, verify sender and delivery. Set short provider OTP expiry. Recovery and invite templates must point directly to the application using the token hash in a URL fragment:
   - Recovery: `{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=recovery`
   - Invite: `{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=invite`
   Use these in the email link href; do not use the default implicit-flow ConfirmationURL. The fragment is not sent to the server or referrer logs. The confirmation page removes it from browser history and requires a user click before POSTing it for native verifyOtp verification. Do not enable email click tracking that rewrites or logs the fragment.
4. Users follow the link, set a password in a 15-minute RECOVERY session, then sign in. Recovery sessions cannot access the studio. Password updates revoke all local sessions.
5. Test with a dedicated test Supabase project before public deployment. Verify email delivery, provider rate limits, native refresh/revocation and deployed HTTPS cookie behavior. No hosted tenant settings or real emails were changed by this implementation.

## Safe manual invitations and first administrator

There is no public signup or browser role assignment. Direct invitation UI is intentionally deferred to this operator procedure, which avoids a cross-provider partial-create flow in this phase.

1. In Supabase Authentication > Users, choose **Invite user** with the approved email. Use the invite template above. Copy the new provider user UUID. For an existing invited account, reuse its verified provider ID; do not duplicate it.
2. Identify the existing Toolhub User ID if that person has historical ownership. Keep that ID and its existing role. A previously seeded user can be linked to its real email without changing owned adverts. Never reuse a person’s ID for someone else. For a new person, supply a new UUID with --user-id.
3. In an operator shell with the intended database and server credentials configured, run:

   `node --env-file=.env scripts/link-auth-user.cjs --user-id EXISTING_OR_NEW_TOOLHUB_ID --provider-user-id SUPABASE_USER_UUID --name "Person Name" --role STAFF --actor-id LINKED_ADMIN_ID --confirm`

   This verifies the UUID with Supabase admin.getUserById, reads email from the provider, rejects conflicting existing links/emails, preserves historical roles and active state, revokes local sessions and writes USER_INVITED. No credentials appear in output. The actor ID is operator audit attribution, not an HTTP authentication mechanism; this command requires trusted shell and service-role access.
4. For the first linked administrator only, replace --actor-id with **--bootstrap-admin** and use role ADMIN. It is rejected as a bootstrap bypass once a linked active Admin exists. If preserving an existing non-Admin owner, do not promote them with this command; create a separate first Admin and use the audited user administration UI afterward.
5. In /settings/users, an Admin can search email/name, change other users’ roles and activate/deactivate accounts. Self-role and self-deactivation changes are blocked. Existing unlinked accounts remain unusable. Disabled users retain all historical records.

The command is an explicit operator mutation. Do not execute it against production until production database changes are authorized.

## Schema and migration

Migration **20260914_production_authentication** is additive:
- User: nullable authProvider and authProviderUserId with composite unique index; active=true by default. Existing IDs, email, roles and all ownership relations retained. Unlinked historical users cannot sign in.
- AuthSession: hashed secret, local User FK, encrypted provider tokens, absolute expiry, APP/RECOVERY purpose, timestamps. Indexes on user and expiry.
- AuthThrottle: opaque HMAC bucket ID, atomic attempt counter and expiry; no email/IP/password/token storage.

Rehearse on a restored disposable backup. Run prisma validate, migrate deploy and verify row counts/ownership before considering production. db:setup uses db push and is **for disposable/development databases only**; never use it as the production migration procedure. Existing P3005 baseline/rehearsal requirements remain separate. Expired sessions/throttle buckets are pruned on auth activity. Purging AuthSession revokes logins but does not delete users or business data. A database rollback must invalidate sessions created after the restored backup; prefer session-table purge and encryption-key rotation to avoid resurrecting revoked sessions.

## Audit and abuse controls

USER_LOGIN, USER_LOGOUT, USER_ROLE_CHANGE, USER_ACTIVATED, USER_DEACTIVATED, USER_INVITED, LOGIN_FAILED, PASSWORD_RESET_STARTED and PASSWORD_UPDATED are recorded without passwords, provider tokens or cookie secrets. Failed logins use anonymous entity attribution and generic messages. Role/status changes retain before/after values and administrator identity.

Database-backed 10-minute counters limit login attempts per normalized email (10), resets per email (3), and aggregate anonymous auth work (200). Bucket IDs are HMACs, not raw email. Supabase provides additional native protections. Provider traffic appears from the app server, so configure provider limits accordingly. An edge/WAF per-IP limit and CAPTCHA may be needed before broad public access; do not trust arbitrary forwarded IP headers in the app. Global/per-account limits can be exhausted by an attacker, temporarily denying legitimate login; monitor this and tune a trusted ingress policy.

## Validation and remaining production review

Run npm test, npm run typecheck, npm run build, npx prisma validate, disposable db:setup and migrate deploy, plus npm audit. Automated tests use a mocked provider and disposable SQLite; no real Supabase network calls. Local browser testing uses a loopback provider fixture, not production identities. Business regression tests cover PDF/manual pricing, real-alpha image checks, self-approval/ownership, immutable artwork, Buffer dry runs and planner/reporting.

Before public deployment: perform hosted Supabase email/recovery/invitation tests, configure HTTPS/SMTP/anti-abuse, review encryption-key custody and persistent database hosting, and complete production migration rehearsal. No MFA or social login is included in this phase. Remaining dependency vulnerabilities are tracked separately; authentication work does not remove them.

References: https://supabase.com/docs/reference/javascript/auth-getuser ; https://supabase.com/docs/guides/auth/passwords ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
