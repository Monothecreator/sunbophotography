import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const CURRENCY = "gbp";

function toPence(amount: number): number {
  return Math.round(amount);
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
  .handler(async ({ data }): Promise<PayoutBalanceResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const balance = await stripe.balance.retrieve();

      const available = balance.available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;
      const pending = balance.pending?.find((b) => b.currency === CURRENCY)?.amount ?? 0;
      const instantAvailable =
        balance.instant_available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;

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
      const stripe = createStripeClient(data.environment);
      const balance = await stripe.balance.retrieve();
      const available = balance.available?.find((b) => b.currency === CURRENCY)?.amount ?? 0;

      if (available <= 0) {
        return { error: "No available balance to withdraw." };
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

