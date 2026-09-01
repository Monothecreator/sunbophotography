# Self-Hosting Documentation Index

Complete guide to running Aperture & Ember independently, removing dependency on Lovable's Cloud infrastructure.

---

## 📚 Documentation Files

### Getting Started
- **[SELF_HOSTING_CHECKLIST.md](./SELF_HOSTING_CHECKLIST.md)** ← **START HERE**
  - Step-by-step checklist to follow
  - Pre-deployment verification
  - Local testing guide
  - Post-deployment validation

### Detailed Guides
- **[self-hosting-setup.md](./self-hosting-setup.md)**
  - Complete walkthrough of all phases
  - Supabase project setup
  - Environment configuration
  - Vercel deployment
  - Netlify deployment
  - Troubleshooting

- **[lovable-workflow.md](./lovable-workflow.md)**
  - How to use Lovable chat while self-hosted
  - Hybrid development approach
  - Local VS Code workflow
  - Security best practices
  - Cost breakdown

- **[vercel-vs-netlify.md](./vercel-vs-netlify.md)**
  - Side-by-side platform comparison
  - Feature analysis
  - Cost comparison
  - Decision guide
  - Setup instructions for both

### Configuration Files
- **[.env.example](../.env.example)**
  - Environment variables template
  - Copy to `.env.local` and fill in your secrets

- **[vercel.json](../vercel.json)**
  - Vercel deployment configuration
  - Auto-detected build settings

- **[netlify.toml](../netlify.toml)**
  - Netlify deployment configuration
  - Build and cache rules

---

## 🚀 Quick Start (5 minutes)

1. **Create Supabase project:** Go to [supabase.com](https://supabase.com), sign up free
2. **Run migrations:** Copy your database schema from `/supabase/migrations/`
3. **Create .env.local:** Copy `.env.example`, fill in your Supabase keys
4. **Test locally:** `npm run dev` and verify auth works
5. **Deploy:** Choose [Vercel](#vercel) or [Netlify](#netlify) and deploy
6. **Test live:** Visit your deployed URL and verify it works

---

## 🎯 Recommended Path

### Path A: Vercel (Easiest, Recommended ⭐)
```
1. Read: SELF_HOSTING_CHECKLIST.md
2. Create: Supabase project
3. Configure: .env.local
4. Test: npm run dev
5. Deploy: [self-hosting-setup.md → Phase 3](./self-hosting-setup.md#phase-3-deploy-to-vercel-recommended)
6. Done!
```
**Time:** ~30 minutes | **Difficulty:** Easy | **Cost:** Free

### Path B: Netlify (Alternative)
```
1. Read: SELF_HOSTING_CHECKLIST.md
2. Create: Supabase project
3. Configure: .env.local
4. Test: npm run dev
5. Deploy: [self-hosting-setup.md → Phase 4](./self-hosting-setup.md#phase-4-deploy-to-netlify-alternative)
6. Done!
```
**Time:** ~30 minutes | **Difficulty:** Easy | **Cost:** Free

### Path C: Full Independence (No Lovable Credits Ever)
```
1. Complete: Path A or B above
2. Read: lovable-workflow.md → "Full Independence" section
3. Set up: VS Code + Git locally
4. Develop: Edit code locally, push to GitHub
5. Deploy: Auto-deploys via Vercel/Netlify
6. Done!
```
**Time:** ~1 hour | **Difficulty:** Intermediate | **Cost:** Free

---

## 💰 Cost Breakdown

### After Self-Hosting
| Service | Cost | Notes |
|---------|------|-------|
| **Vercel** | Free | Unlimited deployments, 100GB bandwidth/month |
| **Netlify** | Free | Unlimited deployments, 100GB bandwidth/month |
| **Supabase** | Free | 500MB storage, 2GB transfer/month (generous free tier) |
| **Stripe** | Free | Only pay when you process payments (~2.9% + 30¢/transaction) |
| **Lovable Chat** | Free* | Only pay credits if you request changes |
| **Total** | ~$0/month | *Optional — can develop in VS Code instead |

### Before Self-Hosting (Lovable Cloud)
| Service | Cost | Notes |
|---------|------|-------|
| **Lovable Cloud** | $30–100/month | Charges credits for infrastructure + edits |
| **Vercel/Netlify** | Not used | Lovable hosts it |
| **Total** | ~$30–100/month | Much more expensive |

**Savings:** ~$360–1,200/year by self-hosting

---

## 🔐 Security

All sensitive information (API keys, database passwords) are stored as **environment variables on your deployment platform**, never in code:

- ✅ `.env.local` → Local development only (`.gitignore` protected)
- ✅ Vercel/Netlify environment variables → Production secrets
- ✅ `.env.example` → Template only (safe to commit)
- ❌ Never commit `.env.local`
- ❌ Never commit real API keys

See [lovable-workflow.md → Security Reminder](./lovable-workflow.md#security-reminder) for details.

---

## 📖 Detailed Table of Contents

### Phase 1: Supabase Setup
1. [Sign up for Supabase (free)](./self-hosting-setup.md#step-1a-sign-up-for-supabase-free)
2. [Get API credentials](./self-hosting-setup.md#step-1b-get-your-supabase-connection-details)
3. [Migrate database schema](./self-hosting-setup.md#step-1c-migrate-your-database-schema)
4. [Enable authentication](./self-hosting-setup.md#step-1d-enable-authentication)
5. [Configure storage](./self-hosting-setup.md#step-1e-configure-storage-buckets)

### Phase 2: Configuration
1. [Create .env.local](./self-hosting-setup.md#step-2a-create-environment-configuration-files)
2. [Production env setup](./self-hosting-setup.md#step-2b-create-production-environment-file)
3. [Check Supabase client](./self-hosting-setup.md#step-2c-check-supabase-client-configuration)
4. [Optional: Switch auth](./self-hosting-setup.md#step-2d-remove-lovable-cloud-auth-dependency-optional)

### Phase 3: Vercel Deployment
1. [Connect GitHub repo](./self-hosting-setup.md#step-3a-connect-your-github-repo-to-vercel)
2. [Set env variables](./self-hosting-setup.md#step-3b-configure-environment-variables)
3. [Configure build](./self-hosting-setup.md#step-3c-configure-build-settings-usually-auto-detected)
4. [Deploy](./self-hosting-setup.md#step-3d-deploy)
5. [Custom domain](./self-hosting-setup.md#step-3e-set-up-custom-domain-optional)

### Phase 4: Netlify Deployment (Alternative)
1. [Connect GitHub repo](./self-hosting-setup.md#step-4a-connect-github-repo-to-netlify)
2. [Configure build](./self-hosting-setup.md#step-4b-configure-build--deploy-settings)
3. [Set env variables](./self-hosting-setup.md#step-4c-add-environment-variables)
4. [Deploy](./self-hosting-setup.md#step-4d-deploy)

### Phase 5: Testing
1. [Test auth](./self-hosting-setup.md#step-5a-test-authentication)
2. [Test database](./self-hosting-setup.md#step-5b-test-database-operations)
3. [Test storage](./self-hosting-setup.md#step-5c-test-file-storage)
4. [Test guest access](./self-hosting-setup.md#step-5d-test-guest-access)
5. [Test payments](./self-hosting-setup.md#step-5e-test-stripe-payments-test-mode)

### Phase 6: Maintenance
1. [Using Lovable while self-hosted](./lovable-workflow.md#workflow-using-lovable-chat-while-self-hosted)
2. [Local development](./lovable-workflow.md#workflow-using-vs-code-locally-full-independence)
3. [Rolling back](./self-hosting-setup.md#rolling-back-deployments)
4. [Monitoring](./self-hosting-setup.md#monitoring--logs)
5. [Backups](./self-hosting-setup.md#database-backups)

### Troubleshooting
- [Common issues and fixes](./self-hosting-setup.md#troubleshooting)
- [Deployment problems](./lovable-workflow.md#troubleshooting)
- [Environment variable issues](./lovable-workflow.md#build-failed-vite_supabase_url-is-not-defined)

---

## ✅ Validation Checklist

After following this guide, verify:

- [ ] Supabase project created with your own database
- [ ] `.env.local` configured with real credentials
- [ ] App runs locally with `npm run dev`
- [ ] Authentication works (can sign up/login)
- [ ] Photos upload to your Supabase Storage
- [ ] Deployed to Vercel or Netlify
- [ ] Live site accessible at your URL
- [ ] GitHub sync pushing changes correctly
- [ ] Deployments auto-trigger on GitHub push

---

## 🆘 Need Help?

### For Specific Steps
- **Supabase:** See [self-hosting-setup.md Phase 1](./self-hosting-setup.md#phase-1-create-your-own-supabase-project)
- **Deployment:** See [vercel-vs-netlify.md](./vercel-vs-netlify.md)
- **Workflow:** See [lovable-workflow.md](./lovable-workflow.md)
- **Troubleshooting:** See [self-hosting-setup.md Phase 7](./self-hosting-setup.md#phase-7-complete-independence-optional)

### External Resources
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [TanStack Start Docs](https://tanstack.com/start/latest)

---

## 🎉 You're All Set!

Your app is now:
- ✅ Completely independent from Lovable's Cloud
- ✅ Running on professional infrastructure
- ✅ Costing nearly $0/month
- ✅ Scalable and fully under your control
- ✅ Can continue using Lovable for editing (optional)

**Next step:** Follow [SELF_HOSTING_CHECKLIST.md](./SELF_HOSTING_CHECKLIST.md)

Happy deploying! 🚀
