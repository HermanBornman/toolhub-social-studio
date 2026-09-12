# Supplier PDF reconciliation

This branch starts at remote agent commit `c0d1bf50d38aad35036ec747399fc28ef8793cd2`, not at the unrelated local history. The validated local delta is `f5ad6ee0e50ea6ea272826069440072ed8a46263`, parent `c371c109a5a64b0c46f61c2822036ed9bd12b160`, tree `f1c4283e72a66e168154b7715eb5b3cf61eb4d2d`.

At fetch time, remote main was `0390ba54b7f55f8df0cdbce4b9aca2a309e492cd`; its common ancestor with the remote agent branch was `1a9b0fc293de76ac338976655c380a7f59b87238`. The earlier no-common-ancestor finding concerns the original local checkout only.

## Transplant and conflict decisions

The binary patch for the 50-file validated commit was applied with three-way context. No unrelated-history merge or force push was used. Three conflicts occurred:

- `app/globals.css`: the remote blob contains invalid UTF-8 starting at byte 15000 and damaged/truncated stylesheet content. Restore the complete validated stylesheet, including Phase 2–4 layouts and the PDF/mobile styles.
- `package-lock.json`: the remote blob contains invalid UTF-8 starting at byte 15000 and is not parseable JSON. Restore the validated lockfile before running npm install. Keep declared dependency versions; no dependency upgrade is part of this reconciliation.
- `lib/remove-background.ts`: integrate the validated PhotoRoom endpoint, PNG checks and status-specific error messages. The remote variant returned raw upstream response text and contained a mojibake dash. Do not restore that response-body exposure.

Comparison also found pre-existing damage outside the patch:

- `app/api/products/[id]/route.ts`: invalid UTF-8 starts at byte 234, in an import, followed by unrelated damaged content. Restore the validated product GET/PUT implementation, including role enforcement, duplicate-SKU validation and audit transactions.
- Ten brand/mascot/template PNGs in the remote tree fail Pillow identification, checksum or truncation validation. Restore the exact validated bytes for the INGCO logo, Toolhub logo/lockup, six mascot images and the 1080 × 1350 master template. This preserves existing branding rather than introducing new artwork.

The four remaining original differences (`ApprovedImage.tsx`, `MoodSelector.tsx`, `lib/moods.ts`, `public/ASSETS.md`) are trailing-newline-only and retain remote bytes. Every other original file was identical between the remote base and validated parent. There is no discarded newer functional remote implementation hidden behind these resolutions.

## Preserved scope

The PDF import workflow, all three pricing modes, product-specific included items, confidence/evidence, audit and migration files are retained. Product library, approvals, Buffer/social publishing, calendar, AI captions, planner, reports, central role checks and renderer remain present. Validation uses mock providers and disposable databases; it does not publish anything or copy API keys.

The existing R1299 saw draft stays in the original local database and is checked through a consistent disposable copy. The original checkout and its running app are retained. Application code does not carry business database state in Git.

## Deployment boundaries

Reconciliation review is separate from production deployment. Environment-backed identity remains unsuitable for unrestricted public deployment and must be addressed in a separately approved authentication task. Central role checks must remain intact.

Production baselining remains conditional on the actual schema, a backup rehearsal and explicit authorization. The historical migration commands in `production-readiness.md` are not permission to apply them to production. No production database is touched here.

No direct embedded-image extractor or automatic separate/combined multi-product advert generator is added. Existing safe review/fallback limitations remain documented.

## Fresh checkout validation notes

Use `npm install`, then `npx prisma generate` before TypeScript/build when a fresh install has only the generic Prisma client stub. Initial TypeScript validation exposed that missing generation step; the project-specific client resolves it without source changes. The installed lockfile and package versions are unchanged from the validated commit. The first install hit a default npm-cache permissions error; using a workspace-local cache succeeded.

The registry audit reports seven vulnerable packages (six high, one critical), including critical findings for Next.js 15.5.2. This is an additional deployment blocker, not a reason to force an unreviewed dependency upgrade into the transplant. No `npm audit fix --force` was run. Address dependency advisories and rerun validation before deployment; the review branch is not production approval.
