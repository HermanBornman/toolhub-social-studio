# Toolhub Social Media Studio

Internal Toolhub application for creating consistent, approved social-media product adverts from a locked master template.

## Project goals

- Allow staff to create Toolhub product adverts from structured fields rather than free-form design.
- Preserve the approved Toolhub/INGCO master layout and brand rules.
- Support approved mascot moods such as Happy, Excited, WOW, Wink, Thumbs Up and Smile.
- Generate high-quality 1080 × 1350 social-media artwork.
- Add product data, selling price, specifications, QR code and campaign messaging.
- Save drafts and route adverts through approval before publishing.
- Add social-media scheduling and publishing integrations in later phases.

## Phase 1: Toolhub Ad Creator V1

The first milestone includes a branded dashboard, locked advert renderer, product image upload, mascot mood selector, South African Rand price formatting, QR generation, live preview, exact-size PNG export, and draft persistence.

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

