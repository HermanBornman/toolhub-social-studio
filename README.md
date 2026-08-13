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

The first milestone will build:

- Toolhub-branded application shell
- Create Advert form
- locked master-template renderer
- product image upload and fitting
- mascot mood selector
- South African Rand price formatting
- working QR code generation
- live advert preview
- PNG export at 1080 × 1350
- Save Draft capability

## Core rule

**Staff enter the product information; the software controls the design.**

Normal staff users must not be able to move logos, change brand colours, freely resize elements or create arbitrary layouts.

## Master template version

`TOOLHUB_SOCIAL_MASTER_V1`

## Planned stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL

## Future phases

1. Product library
2. Approval workflow
3. Social-media calendar
4. Buffer/social publishing integration
5. Automated daily publishing
6. Reporting and analytics
7. Future IQ Retail integration

## Status

Repository initialized and ready for Codex development.
