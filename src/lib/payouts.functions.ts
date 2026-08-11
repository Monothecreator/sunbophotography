import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import type { SupabaseClient } from "@supabase/supabase-js";

const CURRENCY = "gbp";

function toPence(amount: number): number {
  return Math.round(amount);
}

/**
 * Only a studio OWNER may see or move money. Returns the studio the caller owns.
 */
async function requireOwnedStudio(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("studio_members")
    .select("studio_id, role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not verify your studio.");
  if (!data) throw new Error("Only the studio owner can manage earnings.");
  return data.studio_id as string;
}

/**
 * The platform uses a single shared Stripe balance, so a payout must never be
 * allowed to exceed the calling studio's own accrued, unpaid revenue.
 * This computes that ledger from the studio's events/orders (RLS-scoped)
 * minus everything the studio has already withdrawn.
 */
async function getStudioLedger(
  supabase: SupabaseClient<any, any, any>,
  studioId: string,
): Promise<{ earnedPence: number; withdrawnPence: number; entitledPence: number }> {
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id")
    .eq("studio_id", studioId);
  if (eventsError) throw new Error("Could not load your events.");

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);

  let earnedPence = 0;
  if (eventIds.length > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("amount_pence, refunded_pence, status")
      .in("event_id", eventIds)
      .eq("status", "paid");
    if (ordersError) throw new Error("Could not load your sales.");
    earnedPence = (orders ?? []).reduce(
      (sum: number, o: { amount_pence: number | null; refunded_pence: number | null }) =>
        sum + (o.amount_pence ?? 0) - (o.refunded_pence ?? 0),
      0,
    );
  }

  const { data: payouts, error: payoutsError } = await supabase
    .from("payouts")
    .select("amount_pence, status")
    .eq("studio_id", studioId);
  if (payoutsError) throw new Error("Could not load your withdrawals.");

  const withdrawnPence = (payouts ?? [])
    .filter((p: { status: string | null }) => p.status !== "failed" && p.status !== "canceled")
    .reduce((sum: number, p: { amount_pence: number | null }) => sum + (p.amount_pence ?? 0), 0);

  return {
    earnedPence,
    withdrawnPence,
    entitledPence: Math.max(0, earnedPence - withdrawnPence),
  };
}

export type PayoutBalanceResult =
  | {
      availablePence: number;
      pendingPence: number;
      instantAvailablePence: number;
      currency: string;
    }
  | { error: string };

export const getPayoutBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PayoutBalanceResult> => {
    try {
      const ledger = await getPhotographerLedger(context.supabase, context.userId);

      const stripe = createStripeClient(data.environment);
      const balance = await stripe.balance.retrieve();

      const platformAvailable = balance.available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;
      const platformInstant =
        balance.instant_available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;

      // Never report the pooled platform balance — only this photographer's share.
      const available = Math.min(ledger.entitledPence, Math.max(0, platformAvailable));
      const instantAvailable = Math.min(available, Math.max(0, platformInstant));
      const pending = Math.max(0, ledger.entitledPence - available);

      return {
        availablePence: toPence(available),
        pendingPence: toPence(pending),
        instantAvailablePence: toPence(instantAvailable),
        currency: CURRENCY,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


export type PayoutResult =
  | { success: true; payoutId: string; stripePayoutId: string; amountPence: number; status: string }
  | { error: string };

export const createPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; amountPence?: number }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (data.amountPence !== undefined && (typeof data.amountPence !== "number" || data.amountPence <= 0)) {
      throw new Error("Invalid amount");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PayoutResult> => {
    try {
      const ledger = await getPhotographerLedger(context.supabase, context.userId);
      if (ledger.entitledPence <= 0) {
        return { error: "You have no withdrawable earnings yet." };
      }

      const stripe = createStripeClient(data.environment);
      const balance = await stripe.balance.retrieve();
      const platformAvailable = balance.available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;

      // Cap strictly to this photographer's own accrued, not-yet-withdrawn revenue.
      const available = Math.min(ledger.entitledPence, Math.max(0, platformAvailable));

      if (available <= 0) {
        return { error: "Your earnings are not yet settled in Stripe. Try again later." };
      }

      const amountPence = data.amountPence ? Math.min(data.amountPence, available) : available;
      if (amountPence <= 0) {
        return { error: "Withdrawal amount must be greater than zero." };
      }


      const payout = await stripe.payouts.create({
        amount: amountPence,
        currency: CURRENCY,
        method: "standard",
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error: insertError } = await supabaseAdmin
        .from("payouts")
        .insert({
          user_id: context.userId,
          stripe_payout_id: payout.id,
          amount_pence: amountPence,
          currency: CURRENCY,
          status: payout.status,
          failure_code: payout.failure_code ?? null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to record payout", insertError);
        return { error: "Payout was created but could not be recorded. Contact support." };
      }

      return {
        success: true,
        payoutId: row.id,
        stripePayoutId: payout.id,
        amountPence,
        status: payout.status,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export type PayoutListResult = { payouts: PayoutRow[] } | { error: string };

export interface PayoutRow {
  id: string;
  stripe_payout_id: string;
  amount_pence: number;
  currency: string;
  status: string;
  failure_code: string | null;
  created_at: string;
}

export const listPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data)
  .handler(async ({ context }): Promise<PayoutListResult> => {
    try {
      const { data, error } = await context.supabase
        .from("payouts")
        .select("id, stripe_payout_id, amount_pence, currency, status, failure_code, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        return { error: "Could not load payouts." };
      }

      return { payouts: (data ?? []) as PayoutRow[] };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

