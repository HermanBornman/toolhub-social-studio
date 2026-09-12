# Merge blocker remediation

Work remains on `reconcile/pdf-import-production-ready`. No merge is authorized.

## Image boundary

`validatePng` checks canonical PNG data URLs, signature, dimensions before allocation, complete chunk structure, CRC-checked decoding, and actual decoded alpha samples. Processed products must have visible and transparent pixels. Final artwork must decode to an opaque 1080 × 1350 PNG. Source JPEG/WebP images are decoded with Sharp, checked against their claimed MIME type, and limited to a single frame and 16 million pixels. General advert/product writes, PDF review/analysis, PhotoRoom requests/results, submission, media storage and artwork retrieval use these checks. A rejected image is never silently promoted to COMPLETE.

## Immutable final artwork

Submission now requires the final PNG and the saved advert revision. The server validates and stores the PNG in the existing `AdvertisementAsset` table, with a fingerprint of the advert's render fields and submission timestamp. The approval screen displays this stored PNG. Approval requires its asset ID and creates an immutable approved asset in the same transaction as the approval decision. Concurrent/stale edits are rejected. Submitted/approved adverts are locked even for Admin; request changes before editing.

Both publishing and planner activation load the approved asset matching the current snapshot. They do not render a replacement or fetch/fall back to a product image. Missing, invalid or mismatched artwork blocks delivery with `FINAL_ARTWORK_MISSING` or `ARTWORK_REQUIRES_REVIEW`. Retry and reschedule check the same boundary. Existing approved adverts without this asset must go through final-artwork submission and independent review; old SocialPost image data is not automatically trusted. No automatic regeneration is implemented.

The database-backed artwork endpoint is authenticated and private, for internal/dry-run use. Live provider delivery continues to require immutable Supabase object storage URLs. PNG bytes are retained with the social post for verification against the approved asset.

## Audit

Every PDF correction/confirmation appends before/after analysis, specifications, power conditions, pricing input and resolution, source identities, actor and timestamp to `AuditLog`. Image replacements retain before/after data in the event; ordinary snapshots use image hashes to avoid unnecessary duplication. Initial/repeated extraction is recorded, and `extractedPricingJson` remains unchanged on override. Advert edits append old/new prices and all other changed fields, with the originating import/page where present. Original calculated/extracted pricing remains in `pricingAuditJson`. No schema change or migration is required; existing append-only audit and asset tables are used.

## Authorization and defaults

Every API handler has a centralized permission gate before reading or mutating data. Ownership, status and independent-approval checks remain enforced. Service publishing/plan actions validate the actor before idempotency lookups. The subsequent authentication implementation now resolves a verified Supabase session and local active/role mapping. Environment identity is no longer accepted. See `production-authentication.md` for the current session, onboarding and security boundaries.

New forms have blank product/price/specification fields. Fixtures live under tests. Seeded demo products and identities require `TOOLHUB_SEED_DEMO=true` and are disabled when `NODE_ENV=production`; ordinary seeding installs only template, mascot and planning metadata.

## Specifications

Deduplication preserves the first normalized occurrence across specification/feature fields. It equates single wood/metal capacity variants, such as `Wood: 210 mm` and `210 mm wood cutting capacity`, while preserving different materials, values and meaningful modifiers. Extraction skips generic unit matches contained inside labelled capacities. Product snapshots, API persistence and rendering use the same conservative rule. Source evidence is retained in audit history.

## Deployment holds

Do not expose the application publicly until the implemented Supabase/session boundary passes production security review and hosted provider/SMTP verification. These server authorization gates remain in place. Rehearse the existing baseline/migration runbook on a restored production backup before any production database action. This task does not change applied migration SQL or touch production data. Remaining dependency findings require targeted follow-up, not a forced broad upgrade.
