import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { sendOrderReceipt } from "@/lib/receipt.server";
import type { Database } from "@/integrations/supabase/types";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

/** Marks the order behind a completed checkout session as paid. */
async function settleOrder(session: any, env: StripeEnv, origin?: string) {
  const orderId = session?.metadata?.orderId;
  const sessionId = session?.id;
  if (!orderId && !sessionId) return;

  const db = getSupabase();
  const paymentIntentId =
    typeof session?.payment_intent === "string" ? session.payment_intent : null;

  const query = db
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .in("status", ["pending", "expired"])
    .select("id");

  const { data, error } = orderId
    ? await query.eq("id", orderId)
    : await query.eq("stripe_session_id", sessionId);
  if (error) {
    console.error("Failed to settle order", error);
    return;
  }

  // Receipt goes out once, from the server, only for an order Stripe confirmed.
  const settledId = data?.[0]?.id ?? orderId;
  if (settledId) await sendOrderReceipt(db, settledId, env, origin);
}


/** Abandoned/expired checkout: retire the pending order so it isn't phantom revenue. */
async function markExpired(session: any) {
  const orderId = session?.metadata?.orderId;
  const db = getSupabase();
  const q = db.from("orders").update({ status: "expired" }).eq("status", "pending");
  if (orderId) await q.eq("id", orderId);
  else if (session?.id) await q.eq("stripe_session_id", session.id);
}

/**
 * Refunds and disputes revoke entitlement: a fully refunded or disputed order
 * stops granting downloads and stops counting towards revenue.
 */
async function revokeForCharge(charge: any, reason: "refunded" | "disputed") {
  const paymentIntentId =
    typeof charge?.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const db = getSupabase();
  const { data: order } = await db
    .from("orders")
    .select("id, amount_pence")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!order) return;

  const refunded =
    reason === "disputed"
      ? (charge?.amount ?? order.amount_pence ?? 0)
      : (charge?.amount_refunded ?? 0);
  const full = refunded >= (order.amount_pence ?? 0);

  await db
    .from("orders")
    .update({
      refunded_pence: refunded,
      refunded_at: new Date().toISOString(),
      // Partial refunds keep access; a full refund or dispute removes it.
      ...(full ? { status: reason } : {}),
    })
    .eq("id", order.id);
}

async function markFailed(session: any) {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;
  await getSupabase()
    .from("orders")
    .update({ status: "failed" })
    .eq("id", orderId)
    .eq("status", "pending");
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const origin = new URL(req.url).origin;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Delayed-notification methods stay "unpaid" until they settle later.
      if (session.payment_status !== "unpaid") await settleOrder(session, env, origin);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await settleOrder(event.data.object, env, origin);
      break;

    case "checkout.session.async_payment_failed":
      await markFailed(event.data.object);
      break;
    case "checkout.session.expired":
      await markExpired(event.data.object);
      break;
    case "charge.refunded":
    case "refund.updated":
      await revokeForCharge(event.data.object, "refunded");
      break;
    case "charge.dispute.created":
      await revokeForCharge(
        (event.data.object as any)?.charge
          ? { payment_intent: (event.data.object as any)?.payment_intent, amount: (event.data.object as any)?.amount }
          : event.data.object,
        "disputed",
      );
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
