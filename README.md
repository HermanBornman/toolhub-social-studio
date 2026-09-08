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

## Verified supplier-document workflow

Supplier files are processed in this order:

1. Extract embedded PDF text and images.
2. Render each page at high resolution and run OCR.
3. Classify product information, prices, conditions and visual candidates.
4. Select the main product image and remove only that image's background.
5. Present every page as an editable draft with confidence warnings.
6. Require explicit approval before rendering the locked Toolhub template.
7. Save a local audit record containing the source page, corrections, pricing and final artwork.

One draft is created per PDF page by default. Possible multiple-product pages are blocked until the user chooses separate or combined adverts. Missing or unclear nett prices are never used to calculate a selling price.

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

## Current storage boundary

Audit records are stored in IndexedDB on the staff member's browser. Central, cross-device audit storage and staff authentication require a separately approved database and authentication integration.
