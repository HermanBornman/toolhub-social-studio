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

## PDFs without pricing: reading + product isolation

This update is based on the restored application at `043584c`. The existing **Offer & character** pricing section and `lib/pricing.ts` are unchanged.

1. Tick **This PDF has no pricing** and enter the staff AI-service access code.
2. Upload the PDF and choose one page or **Read & isolate** all pages.
3. Each page is rendered at high resolution; embedded text supplements visual reading (which also handles scanned text).
4. The reader returns distinct products, quoted evidence, confidence, specifications and exclusions. It does not populate or calculate any pricing controls in this mode.
5. The image editor isolates the selected main product, removing surrounding text, packaging, badges and compatibility-only illustrations. Multi-product pages require product selection.
6. Review the source beside the AI-edited product. Edit details in the existing Product fields and enter pricing in the unchanged pricing section. Confirm before generating/downloading the advert.
7. Failed pages remain available for retry or manual entry; other page drafts are retained in the current tab. These no-price drafts are not yet persisted across reloads.

### Server setup (not configured by this change)

Set `OPENAI_API_KEY` and `TOOLHUB_IMAGE_ACCESS_CODE` in the deployment environment. Never use `NEXT_PUBLIC_` for either secret or commit their values. The second value is a staff-only access code entered per session; it protects the new paid endpoints. There is no new account system or public anonymous AI access. Configure provider spending limits appropriate to staff usage. Existing `REMOVE_BG_API_KEY` settings and photo handling are unchanged.

- Reading: OpenAI Responses, `gpt-4.1-2025-04-14`, strict structured output, storage disabled.
- Isolation: OpenAI Images edits, `gpt-image-1.5`, high input fidelity, transparent PNG.
- Requests are bounded by size and timeout; no automatic paid retries.
- AI edits can alter small details: this is not a pixel-identical extraction guarantee. Staff comparison is mandatory.
- No-price mode never uses extracted supplier prices or a catalogue/filename guess to change pricing.

API references: https://developers.openai.com/api/docs/guides/text and https://developers.openai.com/api/reference/resources/images/methods/edit

### Verification

`node --test tests/*.test.mjs` covers the existing calculator/fit tests, unchanged price fields during no-price reading, schema rejection, missing credentials, provider failures, structured reading and image-edit parameters using mocked provider responses. `next build --webpack` passes. Live provider reading/isolation still needs configured credentials and a visual check using the supplied saw PDF; mock tests do not prove image fidelity or OCR accuracy.


### Saw-flyer regression correction

Unpriced, unnamed or unfamiliar product pages are routed to review automatically, including when the no-pricing option was not selected. The old first-text-line title and random-digit specification heuristic has been removed. Catalogue matching no longer guesses a product from the PDF filename/page position.

Without AI credentials the reader uses embedded text, or local OCR for scans, then conservatively classifies explicit text. Unknown fields stay empty. This fallback does **not** visually identify a saw or automatically isolate a product: staff must supply missing details and a clean product photo. With credentials the visual reader and image editor handle these tasks, subject to review.

The supplied saw PDF was rendered and read with local OCR: the two cutting capacities and the battery/charger exclusion were correctly classified. The difficult logo/motor text and unnamed product stayed unconfirmed. This is not a claim that the live AI service was tested. The regression tests additionally cover the exact incorrect fragments `Metal:12mm 5` and `\\ 223)`.
