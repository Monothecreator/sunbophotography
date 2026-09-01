# Vercel vs Netlify: Quick Comparison

Choosing where to deploy your Aperture & Ember app. Both are excellent and free for small projects.

---

## Side-by-Side Comparison

| Feature | Vercel | Netlify | Recommendation |
|---------|--------|---------|-----------------|
| **Free Tier** | Unlimited deployments, 100GB bandwidth/month | Unlimited deployments, 100GB bandwidth/month | Tie ✅ |
| **Speed** | Fastest for Next.js/TanStack Start | Good, slightly slower for TanStack | **Vercel** ⭐ |
| **Setup** | Auto-detects TanStack Start | Requires manual build config | **Vercel** ⭐ |
| **Build Time** | Typically 2–3 minutes | Typically 3–5 minutes | **Vercel** ⭐ |
| **Custom Domain** | Free, works great | Free, works great | Tie ✅ |
| **Environment Variables** | Clear UI, easy to manage | Clear UI, easy to manage | Tie ✅ |
| **Monitoring** | Logs, analytics, performance | Logs, analytics | Tie ✅ |
| **Rollbacks** | Instant, one-click | Instant, one-click | Tie ✅ |
| **Git Integration** | GitHub, GitLab, Bitbucket | GitHub, GitLab, Bitbucket | Tie ✅ |
| **Database Hosting** | No (bring your own) | No (bring your own) | Tie ✅ |
| **Learning Curve** | Simple | Simple | Tie ✅ |
| **Support** | Community + docs | Community + docs | Tie ✅ |
| **Scaling** | Excellent (pay per use) | Excellent (pay per use) | Tie ✅ |

---

## Detailed Analysis

### Vercel (Recommended for This Project ⭐)

**Pros:**
- ✅ **Optimized for TanStack Start** — this is the exact framework Vercel specializes in
- ✅ **Auto-detects build config** — minimal setup required
- ✅ **Faster deployments** — 2–3 minutes vs 3–5 minutes
- ✅ **Zero-config environment variables** — just paste them in UI
- ✅ **Excellent documentation** for TanStack projects
- ✅ **Preview deployments** — every commit gets a preview URL

**Cons:**
- ❌ Costs more when you scale (pay per compute time)
- ❌ Vendor lock-in to some Vercel-specific features

**Best for:** TanStack Start projects, photographers who want simplicity, fast deployments

---

### Netlify

**Pros:**
- ✅ **Great for static sites** — excellent caching
- ✅ **Netlify Functions** — serverless backend code (optional)
- ✅ **Forms** — built-in form handling (useful if you add contact forms)
- ✅ **Redirect rules** — powerful URL rewrites via netlify.toml
- ✅ **Generous free tier** — 300 function invocations/month
- ✅ **Friendly community** — excellent support

**Cons:**
- ❌ Requires manual build config for TanStack Start
- ❌ Slightly slower build & deployment times
- ❌ Function cold starts can be slower

**Best for:** Mostly static sites, projects using Netlify Functions, developers who like configuration files

---

## Configuration Effort

### Vercel (Recommended - Easiest)
```
1. Sign in with GitHub
2. Select repository
3. Paste environment variables
4. Click Deploy
5. Done! Auto-detects everything
```
**Estimated time:** 5 minutes

### Netlify
```
1. Sign in with GitHub
2. Select repository
3. Paste environment variables
4. Upload netlify.toml (we've provided it)
5. Click Deploy
6. Done!
```
**Estimated time:** 5 minutes (same, we provided netlify.toml)

---

## Recommended Choice

**For Aperture & Ember, choose Vercel because:**

1. **TanStack Start optimization** — Vercel literally built the platform for this
2. **Faster builds** — 2–3 min vs 3–5 min (multiple deployments/day = saves time)
3. **Zero-config setup** — no files needed, Vercel figures it out
4. **Better performance** — Vercel's edge network is optimized for TanStack
5. **Simpler workflow** — less complexity = fewer things that break

### When to Use Netlify Instead

- You prefer configuration-as-code (`netlify.toml`)
- You plan to use Netlify Functions for serverless code
- You want form handling built-in
- You have multiple team members on Netlify already

---

## Migration Between Platforms

Good news: **it's easy to move between them anytime!**

1. Sign up for the other platform
2. Import your GitHub repo
3. Set environment variables
4. Deploy
5. Update DNS records to point to new URL (or keep both in parallel)

No code changes needed. Both use the same build setup.

---

## Cost as You Scale

### Small Projects (Typical Photographer)
- **Both:** Free
- **Bandwidth:** ~50 GB/month (well under 100 GB limit)
- **Builds:** ~20/month (free)

### Medium Projects (Growing Business)
- **Vercel:** $20–50/month (pay per compute)
- **Netlify:** $0/month (generous free tier)
- **Bandwidth:** ~500 GB/month (still free on both)

### Large Projects (Professional Studio)
- **Vercel:** $50–200/month
- **Netlify:** $10–50/month (depending on functions usage)
- **Bandwidth:** 1–5 TB/month (paid add-on)

**Bottom line:** Start with Vercel (simpler), switch to Netlify if cost becomes a factor (unlikely with your photo delivery use case).

---

## Making Your Choice

### Choose Vercel If
✅ You want the simplest setup  
✅ You care about deployment speed  
✅ You like zero-config approaches  
✅ You don't mind vendor optimization  

### Choose Netlify If
✅ You prefer explicit configuration  
✅ You might use serverless functions later  
✅ You like open-source-friendly platforms  
✅ You already know Netlify well  

### Can't Decide?
**Start with Vercel.** You can switch to Netlify any time without code changes.

---

## Deployment Instructions

### Deploy to Vercel
See: [self-hosting-setup.md → Phase 3](./self-hosting-setup.md#phase-3-deploy-to-vercel-recommended)

### Deploy to Netlify
See: [self-hosting-setup.md → Phase 4](./self-hosting-setup.md#phase-4-deploy-to-netlify-alternative)

---

## Troubleshooting Deployment

| Problem | Vercel | Netlify |
|---------|--------|---------|
| Build fails | Check **Deployments** → **Logs** tab | Check **Deploys** → click build → **Deploy log** |
| Env vars not working | Verify in **Settings** → **Environment** | Verify in **Settings** → **Build & deploy** → **Environment** |
| Site returns 404 | Update `.output/public` as publish directory | Should work with netlify.toml we provided |
| Slow builds | Usually <3 min | Usually <5 min, clear cache if stuck |

---

## Quick Start Decision Tree

```
Do you know what you're doing?
├─ No → Vercel (simplest) ✅
├─ Yes, use Vercel → Vercel ✅
└─ Yes, use Netlify → Netlify ✅
```

**You can't go wrong with either.** Just pick one and deploy!
