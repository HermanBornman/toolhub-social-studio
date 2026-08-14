# Toolhub Social Media Studio

Internal Toolhub production system for brand-safe 1080 × 1350 product adverts. Phase 4 adds factual caption assistance, deterministic content planning, human-approved automated scheduling, and operational management reporting while preserving the approved renderer and Phase 1–3 workflows.

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

## Phase 4 AI caption assistant

The publishing composer produces three structured caption options and supports a shared caption or separate Facebook and Instagram copy. Components never call the provider directly. The server validates structured output, injects the approved advert price, flags likely unsupported claims, records non-secret usage metadata, and falls back to predictable template copy on provider or schema failure.

```env
AI_MODE="mock"               # mock | live
AI_PROVIDER="openai"
AI_MODEL=""                  # required for live mode
OPENAI_API_KEY=""            # server-side only
```

Mock mode is the test and development default and never calls OpenAI. For a controlled live test, configure a model and key in a secured server environment, use Settings → Test AI Connection as Admin, then generate captions for one approved advert. Caption generation never approves, schedules, or publishes content.

Product fields are treated as untrusted data, not instructions. The assistant may use only stored product/advert facts and managed Toolhub hashtags. It must not invent warranty, technical, availability, delivery, discount, accessory, or stock claims. API keys and internal prompts are never returned to staff UI or written to audit metadata.

## Content Planner and controlled automation

The planner ranks only `APPROVED` adverts with deterministic, visible factors: recency, SKU/advert cooldowns, category and campaign balance, approval freshness, priority, limits, and campaign validity. Marketing and Managers may set priority/tags, pin items, generate weekly draft plans, replace or remove items, reorder them, change times, and edit platform captions. Unfilled slots remain gaps when repeat rules prevent safe reuse.

```text
PLANNING_DRAFT → AWAITING_PLAN_APPROVAL → PLAN_APPROVED → ACTIVATED
                                      ↘ CANCELLED
```

The submitter cannot approve their own plan. Activation rechecks advert approval, channel availability, publishing permission, artwork, READY captions, future time, duplicates, conflicts, and campaign expiry for every item. Invalid items are blocked and audited without invalidating successful items.

```env
AUTO_SCHEDULING_MODE="manual" # manual | approved-plans-only
```

`manual` recommends schedules without invoking Buffer. `approved-plans-only` lets a Manager/Admin activate an explicitly approved plan made entirely from human-approved adverts. There is no autonomous advert approval or public posting mode.

## Content strategy and reports

Admin/Marketing configure per-platform weekly frequency, preferred weekdays/time, repeat cooldowns, campaign limits, balancing, and scheduling mode under Settings. Defaults are five weekday posts per channel at 09:00 in `Africa/Johannesburg`, with a 14-day SKU cooldown.

Reports provides Today, 7-day, 30-day, month, and custom filters; approval throughput; publication status; channel reliability; retries; caption source; content mix; unique SKU counts; and repeat warnings from local records. It is labelled Publishing Performance because Phase 4 does not invent reach or engagement data. Dashboard intelligence covers next/upcoming content, approved supply, plan gaps, approvals, publishing issues, and repetition.

## Phase 4 security and testing

- Keep OpenAI, Buffer, and Supabase service-role credentials server-side and out of Git.
- Run tests in `AI_MODE=mock` and `SOCIAL_PUBLISHING_MODE=dry-run`.
- Use `AUTO_SCHEDULING_MODE=approved-plans-only` only for an explicit approved-plan activation test.
- Never use production Buffer channels for a mock workflow.
- Phase 4 excludes IQ Retail, stock/price sync, autonomous advert creation, paid ads, and deep engagement analytics.

## Validation

```bash
npm test
npm run typecheck
npm run build
```
