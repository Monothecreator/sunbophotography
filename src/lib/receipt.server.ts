import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createStripeClient, type StripeEnv } from "./stripe.server";

/**
 * SERVER ONLY — sends the guest their purchase receipt once an order is
 * genuinely paid. Never called from the client: it is invoked from the same
 * server-side settlement paths that flip an order to "paid" (Stripe webhook,
 * return-page settlement, status poll).
 *
 * Exactly-once delivery is enforced in the database: the row is claimed with a
 * conditional update on receipt_sent_at, so concurrent settlement paths can
 * never both send.
 */

type Db = SupabaseClient<Database>;

const FALLBACK_ORIGIN = "https://sunbomedia.dev";

function siteOrigin(origin?: string) {
  return origin || process.env["SITE_URL"] || FALLBACK_ORIGIN;
}

function formatGbp(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

/** Escapes user-controlled text before it is interpolated into the email HTML. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function receiptHtml(input: {
  personName: string;
  eventName: string;
  photoCount: number;
  amountPence: number;
  downloadUrl: string;
}) {
  const photos = `${input.photoCount} ${input.photoCount === 1 ? "photo" : "photos"}`;
  const personName = escapeHtml(input.personName);
  const eventName = escapeHtml(input.eventName);
  const downloadUrl = escapeHtml(input.downloadUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#faf7f3;font-family:Georgia,'Times New Roman',serif;color:#2f2822;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;padding:36px;">
          <tr><td style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#a8763e;">SunboMedia</td></tr>
          <tr><td style="padding-top:18px;font-size:24px;">Thank you, ${personName}.</td></tr>
          <tr><td style="padding-top:12px;font-size:16px;line-height:1.6;color:#5b5048;">
            Your ${photos} from <strong>${eventName}</strong> are ready to download — full resolution, no watermark.
          </td></tr>
          <tr><td style="padding-top:24px;">
            <table role="presentation" width="100%" style="font-size:15px;color:#5b5048;">
              <tr><td style="padding:6px 0;">Event</td><td align="right">${eventName}</td></tr>
              <tr><td style="padding:6px 0;">Photos</td><td align="right">${photos}</td></tr>
              <tr><td style="padding:6px 0;border-top:1px solid #eee5da;">Total paid</td><td align="right" style="border-top:1px solid #eee5da;"><strong>${formatGbp(input.amountPence)}</strong></td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding-top:30px;">
            <a href="${downloadUrl}" style="display:inline-block;background:#2f2822;color:#faf7f3;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;">Download your photos</a>
          </td></tr>
          <tr><td style="padding-top:26px;font-size:13px;color:#8b8078;line-height:1.6;">
            This link is private to you. Keep it safe — anyone with it can download your photos.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Delivers the rendered receipt. Returns false (without throwing) when no
 * sender is configured yet, so settlement is never blocked by email.
 */
async function deliver(to: string, subject: string, html: string): Promise<boolean> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (!from || !resendKey || !lovableKey) {
    console.warn("Receipt not sent: no verified sender domain configured yet");
    return false;
  }

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    console.error(`Receipt send failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  return true;
}

/**
 * Sends the receipt for a paid order, at most once.
 * Safe to call from every settlement path.
 */
export async function sendOrderReceipt(
  db: Db,
  orderId: string,
  env: StripeEnv,
  origin?: string,
): Promise<void> {
  try {
    const { data: order } = await db
      .from("orders")
      .select("id, status, photo_ids, amount_pence, person_id, event_id, stripe_session_id, receipt_email, receipt_sent_at")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.status !== "paid" || order.receipt_sent_at) return;

    // Buyer email: Stripe collects it at checkout; fall back to the contact
    // the photographer stored against this person (personal galleries only).
    const person = order.person_id
      ? (
          await db
            .from("people")
            .select("name, contact, qr_token")
            .eq("id", order.person_id)
            .maybeSingle()
        ).data
      : null;
    const { data: event } = await db
      .from("events")
      .select("name, public_token")
      .eq("id", order.event_id)
      .maybeSingle();
    if (!event) return;

    let email = order.receipt_email ?? null;
    if (!email && order.stripe_session_id) {
      try {
        const stripe = createStripeClient(env);
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        email = session.customer_details?.email ?? null;
      } catch (e) {
        console.error("Could not read buyer email from Stripe", e);
      }
    }
    if (!email && person?.contact?.includes("@")) email = person.contact.trim();
    if (!email) {
      console.warn(`No email address available for order ${orderId}; receipt skipped`);
      return;
    }

    // Claim the send: only one caller can flip receipt_sent_at from null.
    const { data: claimed } = await db
      .from("orders")
      .update({ receipt_email: email, receipt_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("receipt_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return;

    // Shared-album buyers download through their own checkout session, since
    // the album link itself is shared with every guest at the event.
    const downloadUrl = person
      ? `${siteOrigin(origin)}/gallery/${person.qr_token}/downloads`
      : `${siteOrigin(origin)}/album/${event.public_token}/downloads?session_id=${order.stripe_session_id ?? ""}`;

    const photoCount = order.photo_ids?.length ?? 0;

    const sent = await deliver(
      email,
      `Your photos from ${event.name}`,
      receiptHtml({
        personName: person?.name ?? "there",
        eventName: event.name,
        photoCount,
        amountPence: order.amount_pence ?? 0,
        downloadUrl,
      }),
    );

    if (!sent) {
      // Release the claim so a later attempt can retry once email is configured.
      await db.from("orders").update({ receipt_sent_at: null }).eq("id", orderId);
    }
  } catch (e) {
    console.error("Receipt send error", e);
  }
}
