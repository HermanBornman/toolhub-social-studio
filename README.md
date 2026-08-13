# Toolhub Social Media Studio

Internal Toolhub production system for brand-safe 1080 × 1350 product adverts. Phase 2 adds a reusable product library and manager approval workflow while preserving the approved Phase 1 renderer, assets, automatic background removal, QR generation, Rand formatting, and PNG export.

## Local setup

```bash
npm install
npm run db:setup
npm run dev
```

`db:setup` generates the Prisma client, safely synchronizes the SQLite development schema, and seeds approved moods, the locked template, four development users, and `TEST-CIDLI20`. A Phase 2 Prisma migration is retained under `prisma/migrations`; the existing Phase 1 development database should be backed up before applying schema changes outside this workflow.

## Development user and role

Authentication is centralized behind `getCurrentUser()`, `requireRole()`, `canEditAdvert()`, and `canApproveAdvert()` so Auth.js can replace the environment-backed session later.

```env
TOOLHUB_USER_ROLE="STAFF"
TOOLHUB_USER_NAME="Toolhub Staff"
TOOLHUB_USER_ID="dev-staff-1"
```

Seeded identities:

- `dev-staff-1` — Toolhub Staff — STAFF
- `dev-marketing-1` — Toolhub Marketing — MARKETING
- `dev-manager-1` — Toolhub Manager — MANAGER
- `dev-admin-1` — Toolhub Admin — ADMIN

Restart the development server after changing environment variables.

## Product workflow

Products retain searchable SKU, barcode, brand, category, prices, specifications, original image, processed transparent PNG, and active state. Duplicate SKUs return the existing product instead of creating another. Inactive products remain available historically but are excluded from Create Advert search by default.

Selecting a product copies its values into a new Advertisement snapshot. Later product edits never modify historical adverts. A valid stored processed PNG is reused without calling remove.bg again; replacement images run the existing removal process once and update the Product record.

## Approval workflow

```text
DRAFT → AWAITING_APPROVAL → APPROVED
                         ↘ CHANGES_REQUESTED → AWAITING_APPROVAL
                         ↘ REJECTED
```

- STAFF edits their own drafts and requested changes.
- MARKETING can review/edit production copy and submit.
- MANAGER and ADMIN can approve, request changes, or reject.
- Request Changes and Reject require comments.
- Creators and submitters cannot approve their own advert.
- APPROVED adverts are read-only for normal staff.
- Every create, edit, submission, resubmission, review outcome, and product change writes an audit entry.

## Phase 3 social publishing

Approved adverts can be scheduled by MARKETING, MANAGER, and ADMIN users. Publish Now, retry, cancel, reschedule, and provider-status sync are restricted to MANAGER and ADMIN. ADMIN users manage Buffer channels under Settings. Every delivery is split into one Buffer post per channel, retains a final immutable 1080 × 1350 PNG, records every attempt, and preserves successful channel IDs during retries.

The safe default is `SOCIAL_PUBLISHING_MODE="dry-run"`. Dry-run uses deterministic Facebook and Instagram channels and never calls Buffer. Set `BUFFER_API_KEY`, `BUFFER_ORGANIZATION_ID`, Supabase variables, and explicitly select `live` only in a secured server environment. Buffer fetches image URLs at publishing time, so live mode requires a public Supabase bucket. Never expose service-role or Buffer keys to browser code.

The Calendar provides month/week operational views and links to per-channel delivery details. Buffer does not offer webhooks in this integration, so managers can use Sync Status; scheduled statuses are also suitable for a future server cron without changing the data model.

## Validation

```bash
npm test
npm run typecheck
npm run build
```
