import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { priceForSelection, tiersFromEvent } from "./pricing";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "./stripe.server";
import type Stripe from "stripe";

/**
 * GUEST CODE PATH (SHARED ALBUM) — every function here is public (no auth).
 * Access is scoped purely by the event's unguessable public_token, which the
 * photographer prints as one QR code for the whole event.
 *
 * Full-resolution originals are only ever signed for photo ids inside an order
 * that Stripe itself confirmed as paid, and only for the buyer holding that
 * checkout session id — so a shared album link never grants shared downloads.
 */

const tokenSchema = z.string().min(20).max(128).regex(/^[a-f0-9]+$/);
const sessionSchema = z.string().min(10).max(200).regex(/^cs_[A-Za-z0-9_]+$/);
const envSchema = z.enum(["sandbox", "live"]);

const CATALOG_PRICE_ID = "photo_single";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Db = Awaited<ReturnType<typeof admin>>;

async function resolveAlbum(db: Db, token: string) {
  const { data: event, error } = await db
    .from("events")
    .select(
      "id, name, date, status, price_single_pence, price_five_pence, price_gallery_pence",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw new Error("Album lookup failed");
  if (!event) throw new Error("This album link is not valid");
  if (event.status !== "active") throw new Error("This album is no longer available");
  return event;
}

export const getSharedAlbum = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const event = await resolveAlbum(db, data.token);

    const { data: photos } = await db
      .from("photos")
      .select("id, preview_path")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    const items = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await db.storage
          .from("previews")
          .createSignedUrl(p.preview_path, 60 * 60);
        return { id: p.id, previewUrl: signed?.signedUrl ?? "" };
      }),
    );

    return {
      eventName: event.name,
      eventDate: event.date,
      tiers: tiersFromEvent(event),
      photos: items,
    };
  });

type CheckoutResult = { clientSecret: string; orderId: string } | { error: string };

export const startAlbumCheckout = createServerFn({ method: "POST" })
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
    const event = await resolveAlbum(db, data.token);

    // Only photos inside this event can be purchased through its album link.
    const { data: eventPhotos } = await db.from("photos").select("id").eq("event_id", event.id);
    const allowed = new Set((eventPhotos ?? []).map((p) => p.id));
    const photoIds = data.photoIds.filter((id) => allowed.has(id));
    if (photoIds.length === 0) throw new Error("Those photos are not part of this album");

    // Retire abandoned checkouts for this album so they don't linger as pending.
    const staleCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await db
      .from("orders")
      .update({ status: "expired" })
      .eq("event_id", event.id)
      .is("person_id", null)
      .eq("status", "pending")
      .lt("created_at", staleCutoff);

    const amount = priceForSelection(photoIds.length, allowed.size, tiersFromEvent(event));
    if (amount <= 0) throw new Error("Nothing to pay for");

    const { data: order, error } = await db
      .from("orders")
      .insert({
        event_id: event.id,
        person_id: null,
        photo_ids: photoIds,
        amount_pence: amount,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Could not start checkout");

    try {
      const stripe = createStripeClient(data.environment);
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
            price_data: { currency: "gbp", product: productId, unit_amount: amount },
          },
        ],
        payment_intent_data: { description: `${product.name}: ${description}` },
        metadata: { orderId: order.id, eventId: event.id },
      } as unknown as Stripe.Checkout.SessionCreateParams;

      // No automatic tax: the amount charged is exactly the displayed price.
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `order_${order.id}`,
      });

      await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return { clientSecret: session.client_secret ?? "", orderId: order.id };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

export type AlbumPaymentStatus = "paid" | "pending" | "failed" | "unknown";

async function findAlbumOrder(db: Db, eventId: string, sessionId: string) {
  const { data } = await db
    .from("orders")
    .select("id, status, photo_ids, amount_pence")
    .eq("stripe_session_id", sessionId)
    .eq("event_id", eventId)
    .maybeSingle();
  return data;
}

/** Server-side truth: asks Stripe whether the session was actually paid. */
export const getAlbumCheckoutStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string; environment: StripeEnv }) =>
    z
      .object({ token: tokenSchema, sessionId: sessionSchema, environment: envSchema })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      status: AlbumPaymentStatus;
      eventName: string;
      photoCount: number;
      amountPence: number;
      message: string;
    }> => {
      const db = await admin();
      const event = await resolveAlbum(db, data.token);
      const order = await findAlbumOrder(db, event.id, data.sessionId);

      if (!order) {
        return {
          status: "unknown",
          eventName: event.name,
          photoCount: 0,
          amountPence: 0,
          message: "We couldn't find a payment matching this link.",
        };
      }

      const details = {
        eventName: event.name,
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
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id:
                typeof session.payment_intent === "string" ? session.payment_intent : null,
            })
            .eq("id", order.id)
            .in("status", ["pending", "expired"]);
          const { sendOrderReceipt } = await import("./receipt.server");
          await sendOrderReceipt(db, order.id, data.environment);
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
        return { ...details, status: "pending", message: "We're still confirming your payment." };
      }
    },
  );

/**
 * Downloads for a shared album are scoped to the buyer's own checkout session,
 * not to the shared token — otherwise everyone holding the QR would inherit
 * one guest's purchase.
 */
export const getAlbumDownloads = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; sessionId: string }) =>
    z.object({ token: tokenSchema, sessionId: sessionSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const event = await resolveAlbum(db, data.token);
    const order = await findAlbumOrder(db, event.id, data.sessionId);

    if (!order || order.status !== "paid") {
      return { eventName: event.name, photos: [] };
    }

    const paid = order.photo_ids ?? [];
    if (paid.length === 0) return { eventName: event.name, photos: [] };

    const { data: photos } = await db
      .from("photos")
      .select("id, file_path, filename")
      .eq("event_id", event.id)
      .in("id", paid);

    const items = await Promise.all(
      (photos ?? []).map(async (p) => {
        const { data: signed } = await db.storage
          .from("originals")
          .createSignedUrl(p.file_path, 60 * 5, { download: p.filename ?? true });
        return { id: p.id, filename: p.filename ?? "photo.jpg", url: signed?.signedUrl ?? "" };
      }),
    );

    return { eventName: event.name, photos: items };
  });
