# Aperture & Ember

Build a web app called "Aperture&Ember" — an event photo delivery platform for photographers.

CORE CONCEPT

There are two distinct roles with completely separate access — build this as two separate views/routes, not one shared interface with conditional rendering:

ROLE 1 — PHOTOGRAPHER (the "universal controller")

- Has an account: signs up and logs in with email/password

- Is the only role that can log in at all

- Has a private Dashboard (behind auth) where they can:

  - Create a new Event (name + date) — this becomes the "album" guests search for their photos in

  - Upload photos in bulk (drag-and-drop, multi-file, progress bar) into that Event

  - Create "People" within an Event (just a name, e.g. "John") and assign photos to each person

  - Generate a unique QR code + link per Person automatically once photos are assigned

  - See revenue: total sales, sales per event, number of downloads, number of paying customers

  - See engagement: views per gallery, which galleries convert best

- The photographer NEVER shares their login. Guests never see a login screen at all.

ROLE 2 — GUEST (the person who was photographed)

- Has NO account and NEVER logs in — access is entirely via a QR code / link (format: /gallery/:qr_token)

- Scanning the QR code lands them directly on their personal preview page inside that event's album — they never browse the full event library, only their own matched photos

- Can only:

  - View a watermarked, lower-resolution PREVIEW of their photos (grid + full-screen lightbox)

  - Select which photos they want (or choose "Buy Entire Gallery")

  - Pay via Stripe Checkout

  - After payment succeeds: download ONLY the specific photos they paid for, full resolution, watermark-free

- A guest can NEVER download, save, or access the full-resolution original of ANY photo — even the ones they can preview — until that photo is marked "paid" for them specifically in the Order table. This must be enforced server-side (the original file URL should never be sent to the client pre-payment), not just hidden in the UI.

TECH STACK

- Frontend: React + Vite, Tailwind CSS, mobile-first responsive design (PWA-ready)

- Backend: Node.js with a simple REST API (use Supabase for auth + Postgres DB + storage if available, to move fast)

- File storage: Supabase Storage or Cloudflare R2 (see storage notes below)

- Payments: Stripe Checkout (test mode)

- Auth: Email/password or magic link — for photographers ONLY. No guest auth of any kind.

DATA MODEL

- Photographer: id, name, email, business_name

- Event: id, photographer_id, name, date, cover_image, status (active/archived)

- Photo: id, event_id, file_url (full-res, PRIVATE, never sent pre-payment), preview_url (watermarked, public), assigned_person_id (nullable)

- Person: id, event_id, name, qr_token (unique, unguessable), phone/email (optional)

- Order: id, event_id, person_id, photo_ids[], amount, status (pending/paid), stripe_session_id

- Note: "paid access" is per photo_id within an Order, not per Person — a guest who buys 3 of their 24 photos should only ever be able to download those 3.

ROUTE / ACCESS STRUCTURE

- /login, /signup, /dashboard, /dashboard/events/:id — photographer only, behind auth middleware

- /gallery/:qr_token — guest-facing, public, no auth, but token must be long/random enough to not be guessable, and must resolve ONLY to that person's assigned preview photos, never the full event

- /gallery/:qr_token/checkout — Stripe flow

- /gallery/:qr_token/downloads — only renders download links for photo_ids present in a paid Order tied to this qr_token; attempting to access an unpaid photo's file_url should fail server-side, not just be hidden client-side

CORE FLOWS

1. Photographer signs up and logs into their Dashboard

2. Photographer creates a new Event

3. Photographer uploads photos into that Event

4. Photographer creates People and assigns photos to each (checkbox picker)

5. QR code + link auto-generates per Person once photos are assigned

6. Photographer shares the QR code/link with that specific guest (download PNG, copy link, send via WhatsApp/email)

7. Guest scans QR → sees "Hi {name}, we found {count} photos of you" → previews watermarked grid → selects photos → pays via Stripe

8. On payment success, guest is redirected to a Download page showing ONLY the paid photos, full-res, watermark-free, with "Download All (ZIP)" and individual buttons

9. Photographer Dashboard updates in real time (or on refresh): revenue total, per-event revenue, views, purchases

DESIGN

- Photographer Dashboard: efficient, data-forward, like a business admin panel — revenue and event list front and center

- Guest gallery: warm, personal, minimal — like a boutique photography portfolio, not a SaaS product. No mention of "dashboard," "admin," or the photographer's business tools anywhere in the guest experience.

WATERMARKING

- Apply a visible diagonal "SAMPLE" text watermark + photographer logo (placeholder) server-side to preview images before they're ever sent to the guest. Never expose file_url until the matching photo_id is in a paid Order.

PRICING (hardcode for now, make configurable later)

- 1 photo: £5

- 5 photos: £20

- Entire gallery: £50

BUILD ORDER

1. Scaffold DB schema

2. Photographer auth + Dashboard shell (empty states are fine)

3. Event creation + photo upload + preview/watermark generation

4. Manual Person creation + photo assignment + QR/link generation

5. Guest gallery view (preview only, no download capability at all yet)

6. Stripe checkout tied to specific photo_ids

7. Guest download page gated by paid Order lookup

8. Revenue + analytics on the Dashboard

Keep photographer and guest code paths in clearly separate folders/route groups so it's obvious at a glance which code a guest could ever trigger, since that's the security-sensitive boundary in this app. Use placeholder/mock photo data first so the UI is visible before wiring up real storage.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sunbophotography.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c98a6ad5-2037-47e5-b1c6-ae57bf771140).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
