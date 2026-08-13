# Toolhub Social Media Studio

Internal Toolhub application for creating consistent, approved social-media product adverts from a locked master template.

## Project goals

- Allow staff to create Toolhub product adverts from structured fields rather than free-form design.
- Preserve the approved Toolhub/INGCO master layout and brand rules.
- Support approved mascot moods such as Happy, Excited, WOW, Wink, Thumbs Up and Smile.
- Generate high-quality 1080 Ã— 1350 social-media artwork.
- Add product data, selling price, specifications, QR code and campaign messaging.
- Save drafts and route adverts through approval before publishing.
- Add social-media scheduling and publishing integrations in later phases.

## Phase 1: Toolhub Ad Creator V1

The first milestone includes a branded dashboard, locked advert renderer, product image upload, mascot mood selector, South African Rand price formatting, QR generation, live preview, exact-size PNG export, and draft persistence.

### Automatic product cut-outs

Product uploads are sent to the server and processed by the [remove.bg API](https://www.remove.bg/api). The API key is never exposed to browser code. remove.bg returns a cropped PNG with alpha transparency; the locked renderer preserves its aspect ratio and adds only a subtle CSS shadow.

Required environment variables:

```bash
REMOVE_BG_API_KEY="your-remove-bg-api-key"
TOOLHUB_USER_ROLE="STAFF" # STAFF, MARKETING, or ADMIN
```

The app accepts JPG, PNG, and WebP files up to 8 MB. It retains the original data URL and the processed PNG separately, together with a `PENDING`, `PROCESSING`, `COMPLETE`, or `FAILED` status. Normal staff may save/export only after processing reaches `COMPLETE`. Marketing and Admin users may explicitly choose **Use original image** if segmentation quality is poor.

remove.bg charges by image/credit according to the account plan (full-resolution removal is generally one credit). When the account has no remaining quota, or the service is unavailable, the UI shows a failure state and requires another upload; only the role-gated original-image fallback bypasses processing. No generative reconstruction is performed.

## Core rule

**Staff enter the product information; the software controls the design.**

## Local development

```bash
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000.

## Brand assets

See [`public/ASSETS.md`](public/ASSETS.md) for the exact replacement paths for approved Toolhub, INGCO, template, product, and mascot artwork.

## Master template version

`TOOLHUB_SOCIAL_MASTER_V1`
