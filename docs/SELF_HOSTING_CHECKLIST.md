# Self-Hosting Quickstart Checklist

Complete these steps to fully decouple from Lovable's Cloud infrastructure.

## ✅ Pre-Deployment Checklist

### 1. Supabase Project Setup
- [ ] Create new Supabase project at [supabase.com](https://supabase.com)
- [ ] Copy `Project URL` and save securely
- [ ] Copy `anon key` (public) and save
- [ ] Copy `service_role key` (secret) and save
- [ ] Run database migrations to your new project
  - [ ] Option A: Use Supabase CLI (`supabase link` → `supabase db push`)
  - [ ] Option B: Manually paste each migration SQL into SQL Editor
- [ ] Create Storage buckets: `photos` and `previews` (set to public)
- [ ] Enable Email authentication in Auth providers

### 2. Environment Configuration
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in your Supabase values:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Fill in your Stripe keys (if using Stripe):
  - `VITE_STRIPE_PUBLIC_KEY`
  - `STRIPE_SECRET_KEY`
- [ ] **Do NOT commit `.env.local`** (it's in `.gitignore`)

### 3. Local Testing
```bash
# Install dependencies if you haven't already
npm install

# Or if using Bun:
bun install

# Start development server
npm run dev  # or: bun run dev

# Test in browser at http://localhost:5173
# - Sign up with email
# - Verify email from your Supabase project
# - Create an event and upload a test photo
# - Verify data appears in Supabase dashboard
```

### 4. Choose Your Deployment Platform

**Option A: Vercel (Recommended)**
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign in with GitHub
- [ ] Click "Add New Project"
- [ ] Import `sunbophotography` repo
- [ ] Set Environment Variables (see step 5)
- [ ] Click "Deploy"
- [ ] Wait 3–5 minutes for build

**Option B: Netlify**
- [ ] Go to [netlify.com](https://netlify.com)
- [ ] Click "Add new project"
- [ ] Connect GitHub and select repo
- [ ] Set Build Command: `npm run build`
- [ ] Set Publish Directory: `.output/public`
- [ ] Set Environment Variables (see step 5)
- [ ] Click "Deploy"

### 5. Set Deployment Environment Variables

**For Vercel:**
1. Go to **Project Settings** → **Environment Variables**
2. Add each variable:
   - `VITE_SUPABASE_URL` = your-project.supabase.co URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key (mark as "Secret")
   - `VITE_STRIPE_PUBLIC_KEY` = your Stripe public key
   - `STRIPE_SECRET_KEY` = your Stripe secret key (mark as "Secret")
3. Redeploy to apply variables

**For Netlify:**
1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Add same variables as above
3. Redeploy to apply

### 6. Post-Deployment Testing
Visit your live URL (`your-site.vercel.app` or `your-site.netlify.app`):
- [ ] Load homepage
- [ ] Test signup/login (check Supabase Auth logs)
- [ ] Create test event
- [ ] Upload test photo (verify in Supabase Storage)
- [ ] Create test person with QR code
- [ ] Test guest access via QR link (private window)
- [ ] Test Stripe checkout with test card: `4242 4242 4242 4242`

---

## 📋 Important Notes

### What Costs After This Setup
- **Supabase:** Free tier is generous (500MB storage, 2GB transfer/month)
- **Vercel:** Free tier includes unlimited deployments
- **Netlify:** Free tier includes unlimited deployments
- **Stripe:** No setup costs, only pay when you process payments

### What NO LONGER Costs
- ✅ Lovable credits for your **live app** (no more Cloud infrastructure charges)
- ℹ️ You CAN still use Lovable's chat editor for editing (only pay credits when you request changes)

### GitHub Sync
Your code is automatically synced to GitHub. When Lovable makes changes:
1. Changes push to GitHub `main` branch
2. Vercel/Netlify auto-redeploys
3. Your live app updates in ~2–5 minutes

### If Something Breaks
- **Vercel:** Go to **Deployments** → select a previous build → click **"Promote to Production"**
- **Netlify:** Go to **Deploys** → click a previous build → click **"Publish deploy"**

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails with "SUPABASE_SERVICE_ROLE_KEY not found" | Check environment variables are set on deployment platform, no typos |
| Guest links return 404 | Database migrations incomplete — rerun SQL migrations |
| Photos don't upload | Check Supabase Storage bucket exists and is public |
| Stripe errors | Verify keys start with correct prefix (pk_=public, sk_=secret) |
| "Cannot find Supabase" error | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are in env vars |
| CSS/styling broken | Clear cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac) |

---

## 🎉 You're Done!

Your app now runs independently. You can:
- Continue using Lovable's chat for editing (only pay credits for changes you request)
- Your live app runs free on Vercel/Netlify with your own Supabase
- Make updates via GitHub (push → Vercel/Netlify auto-deploys)
- Roll back to previous versions instantly if needed

**Questions?** Check [self-hosting-setup.md](./self-hosting-setup.md) for detailed walkthrough.
