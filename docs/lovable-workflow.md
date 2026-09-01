# Lovable + Self-Hosted Workflow

This document explains how to continue using Lovable's chat editor for building while keeping your live app completely independent and free from Cloud infrastructure charges.

---

## The Hybrid Approach

### Before Self-Hosting
```
You → Lovable Chat → Changes → Lovable's Cloud → Live App
(costs credits for both building AND running)
```

### After Self-Hosting (Hybrid)
```
You → Lovable Chat → Changes → GitHub → Vercel/Netlify → Live App
(costs credits only when you ASK for changes, not for running)
```

### After Self-Hosting (Full Independence)
```
You → VS Code locally → Changes → GitHub → Vercel/Netlify → Live App
(costs nothing except Supabase free tier + Stripe fees)
```

---

## Workflow: Using Lovable Chat While Self-Hosted

This is the **recommended approach** for most users — you get Lovable's convenience for editing, but pay zero credits for your live infrastructure.

### Step 1: Set Up Lovable for GitHub Sync

1. In Lovable's editor, click the **`</>`** (GitHub sync) icon in the top toolbar
2. If not connected yet:
   - Click **"Connect to GitHub"**
   - Authorize Lovable to access your GitHub account
   - Select the `sunbophotography` repository
   - Choose `main` branch
3. Lovable will now:
   - Pull your latest code from GitHub when you open it
   - Push changes back to GitHub when you save

### Step 2: Keep .env.local and Secrets Safe

**In Lovable's editor:**
- You'll see `.env.example` (public, safe to commit)
- You should **NOT** commit `.env.local` (contains secrets)

**On your local machine:**
- Keep `.env.local` locally with real Supabase/Stripe keys
- Lovable doesn't have access to this file (doesn't need it for editing)
- When you test locally: `npm run dev` reads `.env.local`

**On Vercel/Netlify:**
- Secrets are stored as environment variables (not in code)
- Only your deployment platform has access

**Never:**
- ❌ Paste real keys into Lovable's editor
- ❌ Commit `.env.local` to GitHub
- ❌ Share your `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY`

### Step 3: Make Changes in Lovable

In Lovable's chat interface, you can:
- Ask for new features
- Request UI changes
- Fix bugs
- Refactor code
- Ask questions about the code

Example prompts:
```
"Add a dark mode toggle to the header"
"Fix the payment form validation"
"Create a new page for photographer analytics"
"Optimize the photo grid component"
```

### Step 4: Review Changes on GitHub

When Lovable finishes changes:
1. It automatically pushes to your GitHub repo (`main` branch)
2. Go to GitHub → **Commits** to review what changed
3. On GitHub, you'll also see a Vercel/Netlify preview build link

**Your workflow:**
- Lovable makes changes
- GitHub gets updated
- Vercel/Netlify auto-deploys
- Your live site updates in 2–5 minutes

### Step 5: Test on Your Live Site

After Lovable finishes changes:
1. Wait for Vercel/Netlify build to complete (~2–5 min)
2. Visit your live URL
3. Test the new feature/fix
4. If everything looks good: you're done
5. If something broke: roll back (see Troubleshooting below)

---

## Workflow: Using VS Code Locally (Full Independence)

If you want to avoid using Lovable entirely and work locally:

### Prerequisites
```bash
# Install Node.js and npm (or Bun)
# https://nodejs.org/

# Install Supabase CLI (optional, but helpful)
npm install -g supabase
```

### Step 1: Clone Your Repo Locally

```bash
git clone https://github.com/Monothecreator/sunbophotography.git
cd sunbophotography
```

### Step 2: Set Up Environment

```bash
# Install dependencies
npm install

# Create .env.local with your actual values
cp .env.example .env.local

# Edit .env.local and add your real Supabase/Stripe keys
nano .env.local  # or use your editor
```

### Step 3: Develop Locally

```bash
# Start dev server
npm run dev

# Your app runs at http://localhost:5173
# Changes auto-reload in browser
```

### Step 4: Commit and Push

```bash
git add .
git commit -m "Description of changes"
git push origin main

# Vercel/Netlify automatically deploys your changes!
```

### Step 5: Monitor Deployment

- **Vercel:** [vercel.com](https://vercel.com) → Deployments tab
- **Netlify:** [netlify.com](https://netlify.com) → Deploys tab

---

## Hybrid Best Practices

### Use Lovable When
- You want quick UI prototyping
- You're exploring ideas
- You need code explanation/suggestions
- You want to avoid setting up local dev environment

### Use Local VS Code When
- Making security-sensitive changes
- Working offline
- Want full control over every change
- Collaborating with your team

### Recommended Hybrid Approach

For most photographers/small teams:

1. **Use Lovable chat** for most changes (quick & convenient)
2. **Test on your live site** after each change (2–5 min wait)
3. **Use VS Code locally** only when you need to:
   - Debug complex issues
   - Manage secrets safely
   - Work offline
   - Make bulk changes

---

## Cost Breakdown

### Option 1: Lovable Chat + Self-Hosted (Recommended)
- **Lovable credits:** ~$5–20/month (only when you ask for changes)
- **Vercel:** Free ($0)
- **Netlify:** Free ($0)
- **Supabase:** Free tier + $25/month if you exceed limits
- **Stripe:** Free ($0, only pay % on payments)
- **Total:** ~$5–20/month (vs. $30–100 with Lovable Cloud)

### Option 2: VS Code + Self-Hosted (Cheapest)
- **Lovable:** Free ($0, no Cloud credits)
- **Vercel:** Free ($0)
- **Netlify:** Free ($0)
- **Supabase:** Free tier + $25/month if you exceed limits
- **Stripe:** Free ($0, only pay % on payments)
- **Total:** ~$0/month

---

## Troubleshooting

### "My changes aren't showing on the live site"

**Checklist:**
1. Check GitHub: Did Lovable push changes? (go to Commits)
2. Check Vercel/Netlify: Did build complete? (check Deployments tab)
3. Verify: Build status should show ✅ "Ready"
4. Hard refresh: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
5. Wait: Builds can take 3–5 minutes

### "Lovable can't access my repo"

**Fix:**
1. In Lovable, click `</>` (GitHub sync) icon
2. Click **"Reconnect"**
3. Reauthorize and select repo again

### "I accidentally committed .env.local with secrets"

**DO THIS IMMEDIATELY:**
1. Go to GitHub → Settings → Secrets
2. Rotate all compromised keys:
   - Generate new Supabase keys
   - Generate new Stripe keys
3. Go to Vercel/Netlify → update env vars with new keys
4. In your local `.env.local`: update with new keys

### "Build failed: 'VITE_SUPABASE_URL' is not defined"

**Fix:**
1. Go to Vercel/Netlify project settings
2. Check Environment Variables are set
3. Verify no typos
4. Redeploy

### "Lovable won't let me edit the code"

**Possible reasons:**
1. Lovable crashed or lost connection → refresh browser
2. Too many changes at once → smaller edits work better
3. Rate limited → wait a few minutes
4. Project is too large → consider using VS Code locally

### "I want to rollback to a previous version"

**Vercel:**
1. Go to Deployments tab
2. Find a build marked ✅
3. Click the three dots
4. Click "Promote to Production"

**Netlify:**
1. Go to Deploys tab
2. Find a build marked "Published"
3. Click the build
4. Click "Publish deploy"

---

## Important Notes

### GitHub Branch Strategy

Your current setup:
- **Production:** `main` branch (deployed to Vercel/Netlify)
- **Development:** Also `main` (no staging environment)

**If you want staging:**
1. Create a new branch: `staging`
2. Create a separate Vercel/Netlify project for `staging` branch
3. Test changes on staging before merging to `main`
4. This requires more setup but gives you a safety net

### Lovable's GitHub Sync

Lovable's sync only works with the default branch (`main`). You **cannot**:
- ❌ Push to feature branches from Lovable
- ❌ Create pull requests from Lovable
- ✅ Must use main branch (or configure otherwise)

If you want to use feature branches/pull requests:
- Use VS Code locally + Git + GitHub
- Push your own PR → have someone review → merge to main
- Lovable will still be able to edit on main after merge

### Security Reminder

**NEVER share or commit:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `.env.local` file
- Any API key starting with `sk_`

**SAFE to share:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `.env.example` (template only)
- Any key starting with `pk_` (public keys)

---

## Next Steps

1. **If you haven't already:** Complete [SELF_HOSTING_CHECKLIST.md](./SELF_HOSTING_CHECKLIST.md)
2. **Then:** Try making a small change in Lovable chat
3. **Watch:** GitHub → Vercel/Netlify auto-deploy
4. **Test:** Your live site updates automatically

You're now running a professional, scalable app without vendor lock-in! 🎉
