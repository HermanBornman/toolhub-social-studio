# Phase 1 SQLite to Supabase PostgreSQL migration review

This review package is rooted at preserved Phase 1 commit
`2e643f66217b29b546772a40436794785464d57b`. It does not apply SQL to Supabase,
change hosted records, deploy the web app, or send an OTP.

## Source snapshot

- Source: ignored `prisma/dev.db`
- Consistent backup: ignored `prisma/dev.phase1-backup.db`
- Backup SHA-256: `68c4a423daaab402316c8c11622ab6bf8f4fbd5c986850cb517657da4ebd32e1`
- Size: 1,941,504 bytes
- SQLite integrity check: `ok`
- Foreign-key violations: 0
- Application tables: 22
- Prisma migration history table: absent; the SQLite database was created with
  the development `db push` workflow rather than `prisma migrate deploy`

The source contains 49 rows:

| Table | Rows |
| --- | ---: |
| AIUsage | 7 |
| AuditLog | 18 |
| AuthSession | 1 (expired at review time) |
| AuthThrottle | 3 (all expired at review time) |
| Branch | 3 |
| MascotMood | 6 |
| PdfImport | 1 |
| PdfImportPage | 7 |
| PlanningRule | 1 |
| Template | 1 |
| User | 1 |
| All other application tables | 0 |

The one production application identity is `Toolhub Store Manager Test`, mobile
`+27794902832`, role `STORE_MANAGER`, active, assigned to
`Toolhub Polokwane Crossing`, and linked to a Supabase Auth provider identity.
There is exactly one active user with that normalized mobile number.

## Proposed schema changes

1. Keep the original SQLite schema and migrations unchanged for provenance.
2. Add the isolated review schema at `prisma/postgresql/schema.prisma` with:
   - provider `postgresql`
   - `DATABASE_URL` for runtime
   - `DIRECT_URL` for migrations
   - the same 22 models, fields, relations, indexes, defaults, and delete actions
3. Apply `202611030001_postgresql_baseline` only to an empty application schema.
   It creates 22 public application tables, 52 indexes, and 36 foreign keys.
   It does not reference or alter `auth`, `storage`, `realtime`, or system schemas.
4. Apply `202611030002_lock_down_data_api` to enable RLS on all application
   tables and revoke direct table privileges from `anon` and `authenticated`.
   No public Data API policies are created; the application continues to use its
   server-side Prisma database connection.
5. After approval and successful rehearsal, promote the reviewed PostgreSQL
   schema and migration directory to the runtime Prisma paths in a separate,
   reviewable commit. Do not mix SQLite and PostgreSQL SQL in one migration chain.

## Proposed record transfer

1. Put the application into a maintenance window so SQLite cannot change after
   the final backup.
2. Recreate a consistent backup and compare its integrity, foreign keys, row
   counts, and checksum with the reviewed inventory.
3. Run `scripts/export-sqlite-for-postgres.py` against that backup. It opens the
   database read-only, converts SQLite integer booleans to PostgreSQL booleans,
   converts Prisma epoch-millisecond DateTimes to UTC ISO timestamps, validates
   the production Store Manager, and writes a sensitive snapshot only under the
   ignored `tmp/` directory.
4. Apply the PostgreSQL baseline and security migration with `DIRECT_URL`.
5. Import the snapshot in one PostgreSQL transaction, preserving primary keys.
   Insert in the snapshot's dependency order and defer foreign-key validation
   until all rows are present. Do not seed over imported production data.
6. Do not import expired `AuthSession` or `AuthThrottle` rows. The reviewed
   source has no live rows in either table, so expected target counts for those
   tables are zero. This prevents resurrecting expired authentication state.
7. Verify the Store Manager's Supabase Auth user ID is unchanged and unique.
   Auth linkage is application data only; never insert into or modify `auth.users`.
8. Commit the import transaction only after all count, identity, uniqueness,
   foreign-key, and authorization checks pass. Otherwise roll back.

The guarded import utility is `scripts/import-postgres-snapshot.cjs`. It requires
both an explicit `--apply` flag and `MIGRATION_DATABASE_URL`; it refuses remote
targets unless the additional `--allow-remote` flag is supplied. The first
rehearsal must use loopback PostgreSQL only. Production use requires a separate
review and explicit authorization.

## Pre-write verification gate

Before any Supabase write:

1. Review the generated SQL for table count, indexes, foreign keys, defaults,
   delete actions, RLS, and privilege revocation.
2. Validate the PostgreSQL schema with placeholder URLs.
3. Regenerate a baseline with `prisma migrate diff --from-empty` and require a
   byte-for-byte match with the checked-in baseline.
4. Rehearse migrations and the data import against a disposable local PostgreSQL
   database or disposable Supabase branch, never the production project.
5. Run `prisma migrate status` and verify an empty diff between the rehearsal
   database and `prisma/postgresql/schema.prisma`.
6. Compare every table count. Expected source total is 49 rows; expected target
   total is 45 after excluding one expired session and three expired throttles.
7. Run PostgreSQL foreign-key and uniqueness checks, including one active match
   for `+27794902832` and one `(authProvider, authProviderUserId)` match.
8. Confirm RLS is enabled and `anon`/`authenticated` have no table privileges.
9. Point a local app build at the rehearsal database and run tests, typecheck,
   build, Prisma validation, login lookup (without sending OTP), branch checks,
   inactive/unknown-user denial, and logout/session-expiry tests.
10. Take a hosted database backup immediately before the approved production
    migration and record a rollback decision point.

## Rollback boundary

Before target writes, rollback is simply abandoning the empty target and keeping
SQLite as the source of truth. After target writes but before application
cutover, roll back the import transaction or drop only the reviewed application
tables from the disposable rehearsal target. Never touch Supabase system schemas.
After cutover, restore from the recorded hosted backup and invalidate sessions
created after that backup; do not silently switch back to a stale SQLite file.

## Disposable rehearsal result

The review package was rehearsed on 2026-11-03 using an isolated local
PostgreSQL 18 instance under the system temporary directory. Cost was USD 0.
No hosted Supabase endpoint was used.

- Both migrations applied successfully through `prisma migrate deploy`.
- Prisma migration history contains exactly the baseline and lockdown migrations.
- 45 rows imported in one transaction; all expected table counts and ID sets match.
- All 36 foreign keys are present and validated.
- The exact Store Manager provider linkage, role, active state, normalized mobile,
  and Polokwane Crossing branch relationship match the SQLite snapshot.
- Prisma application access resolved the Store Manager and expected row counts.
- RLS is enabled on all 22 application tables and no public policies exist.
- `anon` and `authenticated` each have zero SELECT privileges; direct reads as
  either role fail with PostgreSQL `42501`.
- This verifies the database role boundary used by Supabase Data API. A local
  PostgREST HTTP endpoint was not provisioned for the rehearsal.
- Expired authentication session/throttle rows were excluded as planned.
- The local PostgreSQL process was stopped and the cluster removed from the
  repository worktree after verification.

The rehearsal added the guarded import utility and pinned `pg` 8.16.3 as a
development-only migration dependency. No application runtime behavior changed.
