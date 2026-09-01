# Migrate SunboMedia off Lovable Cloud to your own Supabase

## Goal
Move the SunboMedia backend from Lovable Cloud to a self-managed Supabase project, migrate existing data, keep Google sign-in, and deploy the app to a new host.

## Prerequisites / blockers
- Lovable Cloud is currently paused, so we cannot read or export data from it right now. The first step is resuming it in **Project Settings → Cloud**.
- We need your new Supabase project's credentials (URL, anon key, service-role key) and your preferred new hosting target.

## Plan

### 1. Resume Lovable Cloud and export schema + data
- Resume the backend in Project Settings → Cloud.
- Wait for `ACTIVE_HEALTHY` status.
- Export the current database schema and data:
  - All `public` tables: `profiles`, `studios`, `studio_members`, `studio_invitations`, `events`, `people`, `photos`, `orders`, `payouts`, `gallery_views`.
  - Auth users (via Supabase Auth Admin API or dashboard export).
  - Storage buckets `originals` and `previews`, including bucket policies and file objects.
  - Database functions, triggers, and RLS policies.

### 2. Prepare the new Supabase project
- Create the `originals` and `previews` storage buckets (private).
- Apply the schema migration to recreate tables, indexes, functions, triggers, RLS policies, and GRANT statements.
- Migrate data rows into the new database.
- Migrate storage files from Lovable Cloud buckets to the new buckets (preserving paths/IDs where possible).
- Re-create auth users in the new project (this generates new `auth.users` UUIDs; linked rows in `public` tables must be remapped).

### 3. Reconfigure Google OAuth
- In your new Supabase project, enable the Google provider and set the OAuth redirect URI to the new app's origin (e.g. `https://<your-domain>/auth`).
- Update the app's Google sign-in flow to point at the new Supabase Auth endpoint.

### 4. Update app environment variables
- Replace the Lovable Cloud Supabase URL and keys in `.env`, `.env.development`, and `.env.production` with your new Supabase credentials.
- Update Stripe webhook configuration:
  - Add new webhook endpoints in Stripe for the new production and preview domains.
  - Update `PAYMENTS_LIVE_WEBHOOK_SECRET` and `PAYMENTS_SANDBOX_WEBHOOK_SECRET` secrets.
  - Update the webhook route URL if the domain changes.

### 5. Disconnect Lovable Cloud (optional, irreversible)
- Once the new backend is verified, a workspace admin can disconnect Lovable Cloud from **Cloud → Advanced**.
- Warning: this permanently deletes all Lovable Cloud data for this project.

### 6. Deploy the app to the new host
- Build and deploy the TanStack Start app to your chosen platform (Vercel, Netlify, Cloudflare Pages, self-hosted Node/Worker, etc.).
- Configure environment variables on the host.
- Update DNS / custom domain (`sunbomedia.dev` / `www.sunbomedia.dev`) to point at the new host.

### 7. Verify end-to-end
- Photographer sign-up / Google sign-in.
- Create event, upload photo, create person, assign photo.
- Guest gallery via QR token, watermarked preview, Stripe checkout, payment status, downloads.
- Album gallery and shared album QR.
- Studio team invite flow.
- Payouts / withdrawals.

## What I need from you to start
1. Your new Supabase project URL, anon key, and service-role key.
2. The new hosting target (Vercel, Netlify, Cloudflare Pages, other).
3. Confirmation that you've resumed Lovable Cloud so we can export data.
4. Whether you want me to proceed with disconnecting Lovable Cloud after verification.

## Notes
- This migration will change user UUIDs unless we carefully remap `auth.users` to the new project. Existing orders, payouts, and studio memberships are tied to those UUIDs.
- The Lovable-managed `@lovable.dev/cloud-auth-js` broker currently handles Google sign-in. On your own Supabase, we'll use standard Supabase Google OAuth instead.
- Storage file URLs and any hardcoded references to the old Supabase host must be updated.
