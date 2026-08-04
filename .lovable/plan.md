# Plan: One-click Stripe withdrawal

Add a "Withdraw funds" card to the photographer dashboard that shows the connected Stripe balance and lets the photographer request a manual payout with one click.

## What will be built

1. **Database migration**
   - New `public.payouts` table: `id`, `user_id` (auth.users), `stripe_payout_id`, `amount_pence`, `currency`, `status`, `failure_code`, `created_at`, `updated_at`.
   - GRANTs to `authenticated` and `service_role`, RLS enabled, policies so a user can view only their own payouts.

2. **Server functions** (`src/lib/payouts.functions.ts`)
   - `getPayoutBalance({ environment })` — calls `stripe.balance.retrieve()` and returns `available[]` and `instant_available[]` amounts, plus the default currency.
   - `createPayout({ environment, amountPence, currency })` — protected by `requireSupabaseAuth`.
     - Fetches current available balance.
     - Validates the requested amount does not exceed available balance.
     - Calls `stripe.payouts.create({ amount, currency, method: 'standard' })`.
     - Inserts a row into `payouts` with the returned `po_...` id and status.
     - Returns the new payout id/status or a Stripe error message.
   - Both functions use `createStripeClient(env)` from `@/lib/stripe.server` and catch Stripe errors.

3. **Dashboard UI**
   - Add a "Payouts" section to `src/routes/_authenticated/dashboard.index.tsx`.
   - Show available balance, pending balance, and a "Withdraw available balance" button.
   - On success, show the new payout id and status; on error, show the Stripe message.
   - List recent payouts for the photographer below the button.

4. **Guards and messaging**
   - If the Stripe account is on automatic payouts, `stripe.payouts.create` will fail. The UI will surface Stripe's error and explain that payouts happen automatically on that schedule.
   - A short note will explain that withdrawals are only possible in live mode after go-live is complete; sandbox shows test data only.

## Out of scope

- Changing Stripe's payout schedule (this is configured in the Stripe dashboard).
- Per-event withdrawals — Stripe balance is account-level, not event-level. The plan implements a total-balance withdrawal as requested.

## Verification

- Build passes.
- Dashboard renders the new Payouts card without errors.
- Attempting a payout in sandbox either succeeds (if the test account supports manual payouts) or returns a clear Stripe error in the UI.
