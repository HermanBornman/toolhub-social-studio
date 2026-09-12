# Supplier PDF workflow: production-readiness review

## Deployment boundary

Do not expose this app publicly as a multi-user production service yet. `lib/user-role.ts` currently derives identity/role from process environment, not an authenticated per-user session. An externally authenticated, access-controlled internal deployment needs an explicitly reviewed identity boundary; public deployment needs production authentication. This task does not add an identity feature. Publishing remains dry-run/manual unless separately configured and approved.

No IQ Retail work, merge, scheduling or publishing is part of this change.

## Verified scope

PDF metadata and pages persist independently. Each page retains raw text, OCR output, analysis/confidence/source evidence, image candidates, cleaned image, corrections, pricing snapshot/trace, product-specific inclusion and review identity/time. The resulting advert is a snapshot, not a live join to later Product values.

A digital labelled PDF prefers embedded text and avoids an OCR call. More complex layouts/scans use the existing vision/OCR fallback; image classification/review is still required. Deterministic fixtures cover digital nett pricing, multi-product separation, explicit WAS/NOW extraction, and the scanned reciprocating-saw facts. WAS/NOW are not inferred. The original extraction remains in the pricing audit when a user chooses a manual override.

Multi-product pages do not create separate or combined adverts automatically. Distinct labelled product evidence is retained separately, and merged fields are cleared. Review requires choosing ONE product and manually confirming its own facts, or separate single-product imports/manual creation. Persisting a separate/combined choice is not an implementation of separate/combined generation; those options block draft approval. This safe limitation can remain for an explicitly single-product production rollout.

Direct embedded-image extraction is still not implemented. Correct extraction must handle image masks, transformed/tiled images, color spaces and association with the selected product. Adding it safely is larger than a readiness fix. Preferred priority remains embedded product image (future), classified high-resolution crop, then manual replacement. Current fallback requires image review; automatic whole-page crop requests are rejected. Arbitrary manually uploaded images still require human subject review.

Each render/analysis page has an isolated failure handler. Editing facts resets review state; starting background removal clears the stale processed candidate. Approval/draft creation validates actual visible alpha in bounded non-interlaced 8-bit RGBA/gray-alpha PNGs, rather than just a data URL prefix. Missing/opaque images cannot be approved. An approved manual PNG can recover a failed service result. Palette/interlaced PNGs must first be converted to the supported RGBA format. A transactional page claim prevents duplicate draft creation; repeating create for an existing draft returns that draft. Pages already linked to a draft cannot be re-analysed.

## Database baseline runbook

Never use `migrate reset`, `db push --accept-data-loss`, or seed on an existing production database. `db:setup` uses db push and seed and is a development/bootstrap command only. Back up using a consistent database snapshot, stop writes, inventory table/column/index/foreign-key state, and compare it with a migration replay database before resolving migration history. Do not mark a migration applied merely because its name looks historical.

The original repository lacked the initial migration required by the Phase 2 ALTER/INSERT statements. `20260812_initial_baseline` reconstructs the exact pre-Phase-2 schema from local historical commit `bb75a96^`. The chain replay also exposed AuditLog foreign-key deletion-policy drift. `20260913_audit_retention_alignment` copies every AuditLog column into the schema-equivalent table and changes deletion semantics to SET NULL, preserving audit records. Its replay was tested on disposable databases. It must be tested against a production backup before any production deployment.

For a new empty database:

```powershell
# DATABASE_URL must identify the intended new database. On Windows, create an empty
# SQLite file if the schema engine cannot create the absolute file URL itself.
npx prisma validate
npx prisma migrate deploy
npx prisma migrate status
```

For an existing database proved to match the historical schema THROUGH PHASE 4 and to contain NO PDF tables/columns:

```powershell
# Only after backup and exact schema verification:
npx prisma migrate resolve --applied 20260812_initial_baseline
npx prisma migrate resolve --applied 20260813_phase2_product_approval
npx prisma migrate resolve --applied 20260813_phase3_social_publishing
npx prisma migrate resolve --applied 20260814_phase4_ai_planning_reporting
# Test these pending migrations against the restored backup first:
npx prisma migrate deploy
npx prisma migrate status
```

For a database already matching the FULL current schema (as the local database does), also resolve only already-present PDF/pricing/power/audit-alignment migrations before deploying:

```powershell
npx prisma migrate resolve --applied 20260910_pdf_import_workflow
npx prisma migrate resolve --applied 20260912_import_pricing_modes
npx prisma migrate resolve --applied 20260912_product_power_inclusion
npx prisma migrate resolve --applied 20260913_audit_retention_alignment
npx prisma migrate deploy
npx prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

Skip `resolve` for entries already successfully recorded. Never run the full-current-schema sequence on a database lacking those structures. Any other drift requires a reviewed migration tailored to that actual schema; stop instead of guessing. Production has not been accessed or modified in this task.

Local/test results: copied full schema baselined with unchanged non-migration row hashes; deploy no-op; fresh full-chain deploy and schema comparison passed; local metadata baseline/deploy passed with unchanged data hashes. `db:setup` passed only on a disposable full database copy.

## Original checkout Git findings (historical)

Initial local HEAD: c371c109a5a64b0c46f61c2822036ed9bd12b160.
Remote branch HEAD fetched: c0d1bf50d38aad35036ec747399fc28ef8793cd2.
Branch: agent/toolhub-ad-creator-v1.
The two histories have no common ancestor (10 local-only and 11 remote-only commits before readiness). Similar subjects do NOT make them equivalent. Tree differences include product API logic, CSS, lockfile and Toolhub/INGCO/mascot/template image assets.

Do not force-push or automatically merge unrelated histories. Preserve the local readiness commit; create a separate reconciliation worktree/branch starting at the fetched remote tip. Cherry-pick the readiness commit there, resolve conflicts explicitly, and separately review the 18 pre-existing tree differences/brand assets. Run full validation and review the final tree. Only a descendant of the actual remote tip may be fast-forward pushed to the requested branch. That original readiness task did not perform reconciliation. The separately authorized remote-based transplant is documented in `reconciliation.md`; its review branch preserves remote ancestry.

## Security review

`.env` and local databases/build artifacts are ignored. `tmp/` contains local supplier page/crop images and is intentionally ignored, not shipped. `.env.example` contains configuration names and empty placeholders, not credentials. Working/staged text and reachable local/fetched Git history are scanned without printing credential values. No credential-containing env file is tracked. Pattern scanning is not a proof against every possible unknown secret format.

## Required final checks

Run `npm test`, `npm run typecheck`, `npm run build`, and `npx prisma validate`. Test `npm run db:setup` on a disposable database only. Verify baseline and `npx prisma migrate deploy` against the restored copy and a fresh database. Confirm the real R1299 saw advert remains DRAFT with the approved image and no submission/scheduling/publication. Do not merge until Git reconciliation and the deployment identity boundary are resolved.
