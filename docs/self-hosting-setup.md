# Self-Hosting Setup Guide

This guide walks you through decoupling from Lovable's managed infrastructure and running your Aperture & Ember app independently on Vercel/Netlify with your own Supabase project.

## Overview

**Current:** Your app runs on Lovable's infrastructure (costs credits when you make changes)  
**After:** Your app runs on Vercel/Netlify with your own Supabase project (free tier available, no credit dependency)

---

## Phase 1: Create Your Own Supabase Project

### Step 1a: Sign up for Supabase (Free)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start for free" and sign up with GitHub or email
3. Create a new organization (or use default)
4. Create a new project:
   - **Project name:** `sunbophotography` (or any name)
   - **Database password:** Generate a strong password (save it securely)
   - **Region:** Choose closest to your users or `us-east-1`
   - Click "Create new project" and wait ~2 minutes for initialization

### Step 1b: Get Your Supabase Connection Details

Once your project is ready:

1. Go to **Settings → API** in the left sidebar
2. Copy these values and **save them securely**:
   - `Project URL` (looks like `https://xxxxx.supabase.co`)
   - `anon key` (public key, safe to expose in frontend)
   - `service_role key` (secret, only for backend — never commit!)

### Step 1c: Migrate Your Database Schema

1. In your local Supabase project (`/supabase/migrations/`), you have all migrations
2. In your **new Supabase project**, go to **SQL Editor**
3. Create a new query and run each migration file in order:
   - Copy the contents of each `.sql` file from your `supabase/migrations/` folder
   - Paste into Supabase SQL Editor
   - Click "Run"
   - Repeat for all migration files (check filenames for proper order)

**Alternative (easier):** Use Supabase CLI:
```bash
# Install Supabase CLI if you don't have it
npm install -g supabase

# Link to your new project (it will ask for your Project URL and service role key)
supabase link --project-ref YOUR_PROJECT_ID

# Push all migrations to your project
supabase db push
```

### Step 1d: Enable Authentication

1. Go to **Authentication → Providers** in your Supabase project
2. Enable **Email** provider (enabled by default)
3. Go to **Authentication → Email Templates**
4. Customize email templates if desired (optional)

### Step 1e: Configure Storage Buckets

1. Go to **Storage** → **Buckets** in your Supabase project
2. Create these public buckets (or use different names — update config later):
   - `photos` — for full-resolution originals
   - `previews` — for watermarked preview images
3. For each bucket:
   - Click **Edit bucket** → set **Public bucket** to ON
   - Go to **Policies** and ensure public read access is set (default is fine)

---

## Phase 2: Configure Your Project for Self-Hosting

### Step 2a: Create Environment Configuration Files

Create `.env.local` in your project root (this file should be `.gitignored`, never commit it):

```bash
# Supabase (replace with YOUR new project's values)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Server-side only (backend)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe (keep your existing keys)
VITE_STRIPE_PUBLIC_KEY=your-stripe-public-key
STRIPE_SECRET_KEY=your-stripe-secret-key

# For Lovable Cloud Auth to work (optional, only if using Lovable auth)
# You can skip this if switching to pure Supabase auth
VITE_LOVABLE_PROJECT_ID=your-lovable-project-id
```

### Step 2b: Create Production Environment File

For your **Vercel/Netlify** deployment, you'll set these as **environment variables** in the deployment platform (not as a file). See Phase 3.

### Step 2c: Check Supabase Client Configuration

Verify your app is correctly importing Supabase. Check [src/lib/](../src/lib/) for Supabase client initialization:

Your code should have something like:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
```

This reads from environment variables automatically. No code changes needed.

### Step 2d: Remove Lovable Cloud Auth Dependency (Optional)

If you're currently using `@lovable.dev/cloud-auth-js`, consider:

**Option A (Keep Lovable auth):** Works fine — you'll still use Lovable's chat editor for building (costs credits), but your live app is independent.

**Option B (Switch to Supabase auth):** Removes Lovable dependency entirely for auth:
1. Replace `@lovable.dev/cloud-auth-js` with Supabase auth
2. Update your auth routes to use `supabase.auth.signUp()`, `signIn()`, `signOut()`
3. Remove references to Lovable auth in your app

We can guide you through Option B if you want complete independence.

---

## Phase 3: Deploy to Vercel (Recommended)

Vercel works seamlessly with TanStack Start projects and has a free tier.

### Step 3a: Connect Your GitHub Repo to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (or link your GitHub account)
3. Click **"Add New..."** → **"Project"**
4. Select your `sunbophotography` repo
5. Click **"Import"**

### Step 3b: Configure Environment Variables

On the **Environment Variables** page:

Add each variable from your `.env.local`:

```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
VITE_STRIPE_PUBLIC_KEY = pk_test_...
STRIPE_SECRET_KEY = sk_test_...
```

For sensitive keys (starting with `sk_`), mark them as **Secret**.

### Step 3c: Configure Build Settings (Usually Auto-Detected)

Vercel should auto-detect your TanStack Start setup. If not, set:

- **Framework Preset:** `Other`
- **Build Command:** `npm run build` (or `bun run build`)
- **Output Directory:** `.output/public`
- **Install Command:** `bun install` (or `npm install`)

### Step 3d: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (3–5 minutes usually)
3. Your app is now live at `https://your-project.vercel.app`

### Step 3e: Set Up Custom Domain (Optional)

1. Go to **Vercel Project Settings** → **Domains**
2. Add your custom domain
3. Follow instructions to update DNS records

---

## Phase 4: Deploy to Netlify (Alternative)

If you prefer Netlify instead:

### Step 4a: Connect GitHub Repo to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click **"Add new project"** → **"Import an existing project"**
3. Connect to GitHub and select `sunbophotography`
4. Click **"Next"**

### Step 4b: Configure Build & Deploy Settings

- **Build command:** `npm run build` (or `bun run build`)
- **Publish directory:** `.output/public`
- **Base directory:** (leave empty)

### Step 4c: Add Environment Variables

In **Site settings** → **Build & deploy** → **Environment**:

Add all variables from Step 3b above.

### Step 4d: Deploy

Click **"Deploy"** and wait for build completion. Your app will be at `https://your-site.netlify.app`.

---

## Phase 5: Test Your Self-Hosted App

### Step 5a: Test Authentication

1. Visit your deployed URL
2. Go to `/signup` and create a test account
3. Verify you receive a confirmation email from **your Supabase project** (not Lovable's)

### Step 5b: Test Database Operations

1. Log in and create a test Event
2. Verify the data appears in your **Supabase Dashboard** → **SQL Editor** or **Table Editor**

### Step 5c: Test File Storage

1. Upload a test photo
2. Verify it appears in your Supabase **Storage** bucket

### Step 5d: Test Guest Access

1. Create a Person and assign photos
2. Copy the generated guest link (e.g., `/gallery/abc123...`)
3. Open it in a new private browser window
4. Verify you see the watermarked preview

### Step 5e: Test Stripe Payments (Test Mode)

Use Stripe test card: `4242 4242 4242 4242` with any future expiry and CVC.

---

## Phase 6: Ongoing Maintenance

### Developing with Lovable (Still Using Credits)

You can continue to use Lovable's chat interface to make code changes:

1. Changes are synced to GitHub (`main` branch)
2. Vercel/Netlify auto-redeploys on push
3. No dependency on Lovable's live Cloud infrastructure

### Rolling Back Deployments

If something breaks:
- **Vercel:** Go to **Deployments** tab → click a previous working deployment → click **"Promote to Production"**
- **Netlify:** Go to **Deploys** → click a previous build → click **"Publish deploy"**

### Monitoring & Logs

- **Vercel:** **Deployments** → **Logs** shows build and runtime logs
- **Netlify:** **Deploys** → click a build → **Deploy log** shows build process

### Database Backups

Supabase free tier includes daily backups. To download:
1. Go to **Settings** → **Backups**
2. Click **"Download"** on any backup

---

## Phase 7: Complete Independence (Optional)

If you want to **never use Lovable's credits again**, even for editing:

1. **Set up VS Code locally** and use your own editor
2. **Use Supabase CLI** to manage database migrations
3. **Use GitHub** for version control
4. Vercel/Netlify auto-deploys on every push to `main`

This becomes a fully standard Node.js + React + Supabase workflow.

---

## Troubleshooting

### Build Fails on Vercel/Netlify

**Check:**
1. Build logs for specific error
2. All environment variables are set (no typos)
3. Database migrations completed successfully
4. Supabase project is ready (not still initializing)

### "SUPABASE_SERVICE_ROLE_KEY not found"

**Fix:** Add to environment variables on deployment platform. Check for typos.

### Guest links return 404

**Likely:** Database is empty (migrations didn't run). Run migrations again (Step 1c).

### Photos not uploading

**Check:**
1. Storage bucket exists and is public
2. Supabase API keys are correct
3. Bucket policy allows uploads

### Stripe errors

**Verify:**
1. `VITE_STRIPE_PUBLIC_KEY` is a public key (starts with `pk_`)
2. `STRIPE_SECRET_KEY` is a secret key (starts with `sk_`)
3. Both keys are for the same Stripe account
4. You're using test mode keys (starts with `test`) for testing

---

## Summary

✅ **You've now:**
- Created your own Supabase project (free tier)
- Migrated your database schema
- Deployed your frontend on Vercel or Netlify (free tier)
- Completely decoupled from Lovable's Cloud infrastructure

📌 **Going forward:**
- Use Lovable's chat for editing (only pay credits when you ask for changes)
- Your live app runs independently and never costs Lovable credits
- Full control over your infrastructure and data

