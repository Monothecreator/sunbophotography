# Lively animated homepage

Turn the plain text landing page into a moving, photography-led hero.

## What you'll see

1. **Animated hero slideshow** — a stack of 4–5 event photos that cross-fade in sequence (about 4s each) behind/next to the headline, with a slow Ken Burns zoom so the image never feels static. Auto-plays, loops, pauses for anyone who prefers reduced motion.
2. **Photo strip** — a continuously scrolling marquee of smaller frames further down the page, suggesting a full event gallery.
3. **Entrance motion** — headline, subcopy, buttons and the three feature cards fade/slide up in a staggered sequence on load; cards lift slightly on hover.
4. **Imagery** — I'll generate 6–8 warm, editorial event photos (weddings, parties, portraits) matching the existing cream/terracotta palette and host them as CDN assets.

Copy, links, pricing and all existing functionality stay exactly as they are.

## Technical notes

- New `src/components/home/HeroSlideshow.tsx` and `PhotoMarquee.tsx`; `src/routes/index.tsx` composes them.
- Animation via Tailwind + keyframes added to `src/styles.css` (cross-fade, ken-burns, marquee, staggered fade-in) — no new dependency.
- Images generated, then uploaded through `lovable-assets` and referenced by `.asset.json` pointers so the repo stays light; `loading="lazy"` on everything below the fold, hero first frame eager with width/height set to avoid layout shift.
- Respect `prefers-reduced-motion`: slideshow holds on the first frame, marquee and entrance animations disabled.
- Add descriptive `alt` text; keep the single H1 and existing head metadata/JSON-LD.
