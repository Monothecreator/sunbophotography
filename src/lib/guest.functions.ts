import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { priceForSelection } from "./pricing";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "./stripe.server";
import type Stripe from "stripe";

/**
 * GUEST CODE PATH — every function in this file is public (no auth) and is the
 * complete set of server behaviour a guest can trigger. Access is scoped purely
 * by the unguessable qr_token; a guest can never name an event, a photographer,
 * or another person's row. Original (full-resolution) files are only ever
 * signed for photo ids that appear in a PAID order for that same token.
 *
 * Payment status is NEVER accepted from the client: an order only becomes paid
 * via the Stripe webhook, or via a server-side retrieval of the Stripe session.
 */

const tokenSchema = z.string().min(20).max(128).regex(/^[a-f0-9]+$/);
const envSchema = z.enum(["sandbox", "live"]);

/** Human-readable price id created in the payments catalog. */
const CATALOG_PRICE_ID = "photo_single";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function resolveToken(db: Awaited<ReturnType<typeof admin>>, token: string) {
  const { data: person, error } = await db
    .from("people")
    .select("id, name, event_id")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw new Error("Gallery lookup failed");
  if (!person) throw new Error("This gallery link is not valid");
  const { data: event } = await db
    .from("events")
    .select("id, name, date, photographer_id, status")
    .eq("id", person.event_id)
    .maybeSingle();
  if (!event || event.status !== "active") throw new Error("This gallery is no longer available");
  return { person, event };
}

async function paidPhotoIds(db: Awaited<ReturnType<typeof admin>>, personId: string) {
  const { data: orders } = await db
    .from("orders")
    .select("photo_ids")
    .eq("person_id", personId)
    .eq("status", "paid");
  return new Set((orders ?? []).flatMap((o) => o.photo_ids ?? []));
}

export const getGuestGallery = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { person, event } = await resolveToken(db, data.token);

    const { data: photos } = await db
      .from("photos")
      .select("id, preview_path")
      .eq("assigned_person_id", person.id)
      .order("created_at", { ascending: true });

    const paid = await paidPhotoIds(db, person.id);

    const items = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await db.storage
          .from("previews")
          .createSignedUrl(p.preview_path, 60 * 60);
        return { id: p.id, previewUrl: signed?.signedUrl ?? "", paid: paid.has(p.id) };
      }),
    );

    await db.from("gallery_views").insert({ person_id: person.id, event_id: event.id });

    return {
      personName: person.name,
      eventName: event.name,
      eventDate: event.date,
      photos: items,
      paidCount: items.filter((i) => i.paid).length,
    };
  });

type CheckoutResult = { clientSecret: string; orderId: string } | { error: string };

/**
 * Creates a pending order for the selected photos and opens a real Stripe
 * Checkout session for it. The amount is computed server-side from the
 * photographer's price list — the client never supplies a price.
 */
export const startGuestCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    photoIds: string[];
    returnUrl: string;
    environment: StripeEnv;
  }) =>
    z
      .object({
        token: tokenSchema,
        photoIds: z.array(z.string().uuid()).min(1).max(500),
        returnUrl: z.string().url().max(2000),
        environment: envSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const db = await admin();
    const { person, event } = await resolveToken(db, data.token);

    // Only photos actually assigned to this person can be purchased.
    const { data: mine } = await db
      .from("photos")
      .select("id")
      .eq("assigned_person_id", person.id);
    const allowed = new Set((mine ?? []).map((p) => p.id));
    const photoIds = data.photoIds.filter((id) => allowed.has(id));
    if (photoIds.length === 0) throw new Error("Those photos are not part of your gallery");

    const amount = priceForSelection(photoIds.length, allowed.size);
    if (amount <= 0) throw new Error("Nothing to pay for");

    const { data: order, error } = await db
      .from("orders")
      .insert({
        event_id: event.id,
        person_id: person.id,
        photo_ids: photoIds,
        amount_pence: amount,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Could not start checkout");

    try {
      const stripe = createStripeClient(data.environment);

      // Reuse the catalog product (it carries the digital-goods tax code) but
      // price it dynamically, since the total depends on how many photos the
      // guest picked.
      const prices = await stripe.prices.list({ lookup_keys: [CATALOG_PRICE_ID], limit: 1 });
      const catalogPrice = prices.data[0];
      if (!catalogPrice) throw new Error("Price not found");
      const productId =
        typeof catalogPrice.product === "string" ? catalogPrice.product : catalogPrice.product.id;
      const product = await stripe.products.retrieve(productId);

      const description = `${photoIds.length} ${photoIds.length === 1 ? "photo" : "photos"} — ${event.name}`;

      const params = {
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              product: productId,
              unit_amount: amount,
            },
          },
        ],
        payment_intent_data: { description: `${product.name}: ${description}` },
        metadata: { orderId: order.id, personId: person.id, eventId: event.id },
      } as unknown as Stripe.Checkout.SessionCreateParams;

      let session: Stripe.Checkout.Session;
      try {
        // Preferred: Stripe handles tax compliance, fraud, disputes and
        // transaction support end to end.
        session = await stripe.checkout.sessions.create({
          ...params,
          managed_payments: { enabled: true },
        } as Stripe.Checkout.SessionCreateParams);
      } catch {
        // Fall back to tax calculation and collection only if the seller
        // account is not eligible for full compliance handling.
        session = await stripe.checkout.sessions.create({
          ...params,
          automatic_tax: { enabled: true },
        } as Stripe.Checkout.SessionCreateParams);
      }

      await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

      return { clientSecret: session.client_secret ?? "", orderId: order.id };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

/**
 * Called on the return page. Asks Stripe directly whether the session was paid
 * and settles the matching order. This is a convenience path so the guest is
 * not left waiting on webhook delivery — it never trusts the client's claim,
 * only Stripe's own record of the session.
 */
export const settleGuestCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string; environment: StripeEnv }) =>
    z
      .object({
        token: tokenSchema,
        sessionId: z.string().min(10).max(200).regex(/^cs_[A-Za-z0-9_]+$/),
        environment: envSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ paid: boolean }> => {
    const db = await admin();
    const { person } = await resolveToken(db, data.token);

    const { data: order } = await db
      .from("orders")
      .select("id, status")
      .eq("stripe_session_id", data.sessionId)
      .eq("person_id", person.id)
      .maybeSingle();
    if (!order) return { paid: false };
    if (order.status === "paid") return { paid: true };

    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      if (session.payment_status === "unpaid") return { paid: false };

      await db
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("status", "pending");
      return { paid: true };
    } catch {
      return { paid: false };
    }
  });

export type GuestPaymentStatus = "paid" | "pending" | "failed" | "unknown";

/**
 * Status page read. Same server-side truth as settleGuestCheckout (it settles
 * the order when Stripe says the money landed) but reports a richer state so
 * the guest can see whether a slow payment method is still clearing.
 */
export const getGuestCheckoutStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string; environment: StripeEnv }) =>
    z
      .object({
        token: tokenSchema,
        sessionId: z.string().min(10).max(200).regex(/^cs_[A-Za-z0-9_]+$/),
        environment: envSchema,
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      status: GuestPaymentStatus;
      personName: string;
      eventName: string;
      photoCount: number;
      amountPence: number;
      message: string;
    }> => {
      const db = await admin();
      const { person, event } = await resolveToken(db, data.token);

      const base = { personName: person.name, eventName: event.name };

      const { data: order } = await db
        .from("orders")
        .select("id, status, photo_ids, amount_pence")
        .eq("stripe_session_id", data.sessionId)
        .eq("person_id", person.id)
        .maybeSingle();

      if (!order) {
        return {
          ...base,
          status: "unknown",
          photoCount: 0,
          amountPence: 0,
          message: "We couldn't find a payment matching this link.",
        };
      }

      const details = {
        ...base,
        photoCount: order.photo_ids?.length ?? 0,
        amountPence: order.amount_pence ?? 0,
      };

      if (order.status === "paid") {
        return { ...details, status: "paid", message: "Payment received." };
      }

      try {
        const stripe = createStripeClient(data.environment);
        const session = await stripe.checkout.sessions.retrieve(data.sessionId);

        if (session.payment_status !== "unpaid") {
          await db
            .from("orders")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", order.id)
            .eq("status", "pending");
          return { ...details, status: "paid", message: "Payment received." };
        }

        if (session.status === "expired") {
          return {
            ...details,
            status: "failed",
            message: "This checkout expired before payment completed.",
          };
        }

        return {
          ...details,
          status: "pending",
          message: "Your payment is still clearing with your bank.",
        };
      } catch {
        return {
          ...details,
          status: "pending",
          message: "We're still confirming your payment.",
        };
      }
    },
  );



export const getGuestDownloads = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { person, event } = await resolveToken(db, data.token);
    const paid = await paidPhotoIds(db, person.id);
    if (paid.size === 0) {
      return { personName: person.name, eventName: event.name, photos: [] };
    }

    const { data: photos } = await db
      .from("photos")
      .select("id, file_path, filename")
      .eq("assigned_person_id", person.id)
      .in("id", [...paid]);

    const items = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await db.storage
          .from("originals")
          .createSignedUrl(p.file_path, 60 * 5, { download: p.filename ?? true });
        return { id: p.id, filename: p.filename ?? "photo.jpg", url: signed?.signedUrl ?? "" };
      }),
    );

    return { personName: person.name, eventName: event.name, photos: items };
  });
