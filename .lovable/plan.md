# Installable app + multi-photographer accounts

Two pieces of work: make SunboMedia installable as a phone app, and make it safe for many independent photographers to sign up and run their own studio inside it.

## Part 1 — Installable app (PWA)

Today the site has no app manifest or icons, so phones treat it as a plain web page.

- Add an app manifest with the SunboMedia name, brand colours and `standalone` display so it opens full-screen with no browser bars.
- Generate app icons (192px, 512px, maskable, plus an Apple touch icon) and wire them into the page head.
- Add an "Install app" hint on the dashboard for photographers on mobile (dismissible, only shown when the browser supports installing).
- No offline mode and no service worker — you asked for installable first, and offline caching adds real risk of guests seeing stale galleries.

Result: photographers (and guests, from a QR link) can "Add to Home Screen" and get an app icon that launches straight into the app.

Store submission (App Store / Play) stays a later step: it needs a GitHub export, a Capacitor shell, an Apple Developer account (£79/yr) and a Google Play account ($25 one-off). Happy to plan that separately once the PWA is live.

## Part 2 — Multi-photographer scaling

Each photographer signs up, gets their own studio, their own events, their own money. One owner per account, plus optional members.

### Studio identity
- Extend the profile with studio branding: business name, logo, contact email, optional website.
- Guest gallery and album pages show the owning photographer's studio name and logo instead of a generic SunboMedia header, so each studio's guests see that studio's brand.
- Receipt emails use the studio name as the sender label and header.

### Owner + member access
- Add a membership table linking users to a studio with a role (`owner` or `member`), and a role-check function used by every access rule.
- Owner: everything, including revenue, payouts and inviting/removing members.
- Member: create events, upload and tag photos, generate QR codes. Cannot see revenue figures or withdraw funds.
- Invite by email from a new Team section in the dashboard. Invited person signs up (email or Google) and lands in that studio.
- Every existing event/photo/person/order rule moves from "belongs to this user" to "belongs to this studio", with existing data migrated so nothing is lost.

### Money per studio
Payouts already compute a per-photographer ledger and cap withdrawals to what that photographer actually earned, so no one can draw another studio's money. Changes needed:
- Move the ledger from per-user to per-studio, so an owner sees the studio's earnings and members see nothing.
- Only owners can open the withdraw flow; the button is hidden for members.
- Payout history is shown per studio.

### Signup and safety
- Signup is already open to anyone with email or Google — no change needed there.
- New signups get a studio created automatically with them as owner.
- Add a small onboarding step after first sign-in: studio name + logo, then straight into "Create your first event".

## Technical notes

- Manifest at `public/manifest.webmanifest`, icons in `public/`, `<link>` tags added in `src/routes/__root.tsx`. No `vite-plugin-pwa`, no service worker.
- New tables: `studios` (name, logo, contact, slug) and `studio_members` (studio_id, user_id, role enum). Role checks go through a `SECURITY DEFINER` function to avoid recursive policy errors.
- `events` gains `studio_id`; a migration backfills it from `photographer_id` and creates one studio per existing photographer. `photographer_id` stays as the creator reference.
- All RLS policies on `events`, `people`, `photos`, `orders`, `gallery_views`, `payouts` rewrite to studio membership; revenue-bearing reads add an owner-role check.
- `src/lib/payouts.functions.ts` — `getPhotographerLedger` becomes studio-scoped and gated to owners.
- Guest-facing routes are unaffected in behaviour; they gain studio branding fields in their existing server-function payloads.
- New: `src/routes/_authenticated/dashboard.team.tsx`, an invitations table with token + expiry, and an accept-invite route.

## How to test

1. Install from Safari (iOS) and Chrome (Android) — icon appears, app opens full-screen.
2. Sign up as a brand-new photographer, create a studio, create an event, upload photos — confirm you cannot see the first account's events anywhere.
3. Invite a member, accept from a second account, confirm they can upload but see no revenue and no withdraw button.
4. Buy a photo as a guest in studio B; confirm studio A's balance is unchanged and studio B's available balance increases.
5. Attempt a withdrawal as a member — should be refused.
