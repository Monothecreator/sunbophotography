import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

/** Marks the order behind a completed checkout session as paid. */
async function settleOrder(session: any) {
  const orderId = session?.metadata?.orderId;
  const sessionId = session?.id;
  if (!orderId && !sessionId) return;

  const query = getSupabase()
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("status", "pending");

  const { error } = orderId
    ? await query.eq("id", orderId)
    : await query.eq("stripe_session_id", sessionId);
  if (error) console.error("Failed to settle order", error);
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Delayed-notification methods stay "unpaid" until they settle later.
      if (session.payment_status !== "unpaid") await settleOrder(session);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await settleOrder(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
      await markFailed(event.data.object);
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
