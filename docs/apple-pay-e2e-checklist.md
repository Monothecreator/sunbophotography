# Apple Pay end-to-end test checklist (Safari / iOS)

Apple Pay only renders in Safari (macOS) and iOS Safari with a card in Wallet.
It can never be verified in Chrome, Chromium, or an automated headless browser —
so this checklist pairs an automated preflight with a short manual device pass.

## 0. Preflight (automated, no device needed)

Run from the project root:

```bash
bun run scripts/check-apple-pay-readiness.ts sandbox   # or: live
```

Passes when:
- [ ] Active payment method configuration reports Apple Pay `available: true`
- [ ] `display_preference.value` is `"on"`
- [ ] The checkout domain is registered (Lovable manages `*.lovable.app`; a
      custom domain must be registered with Apple Pay after DNS is pointed)

Or `bun run check:apple-pay live`. The same result is visible in the dashboard
under **Payments → Apple Pay status**, and CI runs it on every push/PR and daily
via `.github/workflows/apple-pay-readiness.yml` — a non-zero exit fails the build.
CI needs the `LOVABLE_API_KEY`, `STRIPE_SANDBOX_API_KEY`, and (for live)
`STRIPE_LIVE_API_KEY` repository secrets.

## 1. Button appears (manual, real device)

Device: iPhone with iOS Safari, or macOS Safari on a Mac with Touch ID / paired iPhone.
A real card must be in Wallet — test cards can be added to Wallet in Sandbox via
[Stripe's Apple Pay test setup](https://docs.stripe.com/apple-pay#testing).

- [ ] Open a guest gallery link: `/gallery/<token>` (or an album link `/album/<token>`)
- [ ] Select at least one photo; the footer shows the correct total
- [ ] Tap **Continue to checkout** — the embedded Stripe form loads
- [ ] An **Apple Pay** button renders above the card fields
- [ ] Tapping it opens the native Apple Pay sheet with the correct merchant
      name, GBP currency, and the exact amount shown in the footer
      (£5 / photo, £20 per 5, £50 capped for the whole gallery)

If the button is missing, check in order: not Safari → no card in Wallet →
domain unregistered → Apple Pay off in the payment method configuration (step 0).

## 2. Payment confirms the order as paid

- [ ] Authorise the sheet with Face ID / Touch ID
- [ ] Stripe redirects to `/gallery/<token>/status?session_id=...`
- [ ] The status page shows the pending state, then flips to paid without a
      manual refresh (it polls every 3s)
- [ ] It then navigates to `/gallery/<token>/downloads`

## 3. Server-side settlement is real (not just UI)

- [ ] The `checkout.session.completed` event is delivered to
      `/api/public/payments/webhook?env=sandbox` with a **200** in Stripe's
      webhook log (no 4xx, no retries)
- [ ] The matching `orders` row has `status = 'paid'`, the correct
      `amount_pence`, and `photo_ids` exactly matching the selection
- [ ] `receipt_sent_at` is set and the receipt email arrived once (not twice)

Query to confirm:

```sql
select id, status, amount_pence, array_length(photo_ids, 1) as photos,
       stripe_session_id, receipt_sent_at
from orders
order by created_at desc
limit 5;
```

## 4. Download gating still holds

- [ ] The downloads page lists **only** the paid photo ids
- [ ] A photo that was previewed but not purchased has no full-resolution URL
      anywhere in the network responses
- [ ] Opening the downloads URL in a different browser/session does not grant
      access to the paid files (downloads are scoped to the settled session)

## 5. Failure paths

- [ ] Cancelling the Apple Pay sheet returns to the embedded form with the
      selection intact and no order marked paid
- [ ] Declining the wallet payment leaves the order `pending` and shows an
      error in the checkout form
- [ ] Pressing back from checkout ("← Back to your photos") and re-entering
      creates a fresh session without duplicating the order

## Notes

- Sandbox and live each have their own Apple Pay domain registration; passing
  in sandbox does not prove live is registered. Re-run step 0 with `live`
  after go-live.
- Apple Pay is not restricted by `payment_method_types` in this app; it is
  driven entirely by the Stripe payment method configuration, so no code
  change is needed to enable or disable it.
