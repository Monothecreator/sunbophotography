import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { priceForSelection } from "./pricing";

/**
 * GUEST CODE PATH — every function in this file is public (no auth) and is the
 * complete set of server behaviour a guest can trigger. Access is scoped purely
 * by the unguessable qr_token; a guest can never name an event, a photographer,
 * or another person's row. Original (full-resolution) files are only ever
 * signed for photo ids that appear in a PAID order for that same token.
 */

const tokenSchema = z.string().min(20).max(128).regex(/^[a-f0-9]+$/);

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

export const startGuestCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; photoIds: string[] }) =>
    z.object({ token: tokenSchema, photoIds: z.array(z.string().uuid()).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
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

    const { data: order, error } = await db
      .from("orders")
      .insert({
        event_id: event.id,
        person_id: person.id,
        photo_ids: photoIds,
        amount_pence: amount,
        status: "pending",
      })
      .select("id, amount_pence")
      .single();
    if (error || !order) throw new Error("Could not start checkout");

    return { orderId: order.id, amountPence: order.amount_pence, photoCount: photoIds.length };
  });

/**
 * TEST-MODE settlement. Stripe Checkout is not connected yet; when it is, this
 * is replaced by a Stripe webhook that flips the order to paid. Payment status
 * is never trusted from the client beyond this placeholder.
 */
export const confirmTestPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; orderId: string }) =>
    z.object({ token: tokenSchema, orderId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { person } = await resolveToken(db, data.token);
    const { error } = await db
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .eq("person_id", person.id)
      .eq("status", "pending");
    if (error) throw new Error("Could not confirm payment");
    return { ok: true };
  });

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
