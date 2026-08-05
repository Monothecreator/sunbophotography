import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { makeWatermarkedPreview } from "@/lib/watermark";
import { formatGBP } from "@/lib/pricing";
import { EventPricingCard } from "@/components/EventPricingCard";

export const Route = createFileRoute("/_authenticated/dashboard/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event workspace — Aperture&Ember" },
      { name: "description", content: "Upload photos, match guests and share QR galleries." },
      { property: "og:title", content: "Event workspace — Aperture&Ember" },
      { property: "og:description", content: "Upload photos and share guest galleries." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventWorkspace,
});

type PreviewPhoto = {
  id: string;
  preview_path: string;
  file_path: string;
  assigned_person_id: string | null;
  url: string;
};

function EventWorkspace() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [personName, setPersonName] = useState("");
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [albumQrDataUrl, setAlbumQrDataUrl] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState("");


  const { data } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const [{ data: event }, { data: people }, { data: photos }, { data: orders }] =
        await Promise.all([
          supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
          supabase.from("people").select("*").eq("event_id", eventId).order("created_at"),
          supabase.from("photos").select("*").eq("event_id", eventId).order("created_at"),
          supabase.from("orders").select("*").eq("event_id", eventId).eq("status", "paid"),
        ]);
      const withUrls: PreviewPhoto[] = await Promise.all(
        (photos ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("previews")
            .createSignedUrl(p.preview_path, 3600);
          return {
            id: p.id,
            preview_path: p.preview_path,
            file_path: p.file_path,
            assigned_person_id: p.assigned_person_id,
            url: signed?.signedUrl ?? "",
          };
        }),
      );
      return { event, people: people ?? [], photos: withUrls, orders: orders ?? [] };
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("id", user.user.id)
      .maybeSingle();

    setUploading({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const base = `${user.user.id}/${eventId}/${crypto.randomUUID()}`;
      const preview = await makeWatermarkedPreview(file, profile?.business_name ?? "");
      await supabase.storage.from("originals").upload(`${base}-full`, file, {
        contentType: file.type,
      });
      await supabase.storage.from("previews").upload(`${base}-preview.jpg`, preview, {
        contentType: "image/jpeg",
      });
      await supabase.from("photos").insert({
        event_id: eventId,
        file_path: `${base}-full`,
        preview_path: `${base}-preview.jpg`,
        filename: file.name,
      });
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("people").insert({ event_id: eventId, name: personName });
    setPersonName("");
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function toggleAssign(photoId: string, current: string | null) {
    if (!activePerson) return;
    const next = current === activePerson ? null : activePerson;
    await supabase.from("photos").update({ assigned_person_id: next }).eq("id", photoId);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function saveTitle() {
    const name = titleDraft.trim();
    if (!name) return;
    await supabase.from("events").update({ name }).eq("id", eventId);
    setEditingTitle(false);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
    await qc.invalidateQueries({ queryKey: ["events"] });
  }

  async function savePersonName(personId: string) {
    const name = personDraft.trim();
    if (!name) return;
    await supabase.from("people").update({ name }).eq("id", personId);
    setEditingPerson(null);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function deletePerson(personId: string, name: string) {
    if (!window.confirm(`Delete ${name}? Their gallery link will stop working.`)) return;
    await supabase.from("photos").update({ assigned_person_id: null }).eq("assigned_person_id", personId);
    await supabase.from("people").delete().eq("id", personId);
    if (activePerson === personId) setActivePerson(null);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function deletePhoto(photo: PreviewPhoto) {
    if (!window.confirm("Delete this photo permanently?")) return;
    await supabase.from("photos").delete().eq("id", photo.id);
    await supabase.storage.from("previews").remove([photo.preview_path]);
    await supabase.storage.from("originals").remove([photo.file_path]);
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }



  const people = data?.people ?? [];
  const photos = data?.photos ?? [];
  const selected = people.find((p) => p.id === activePerson);
  const galleryUrl = selected
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/gallery/${selected.qr_token}`
    : "";
  const assignedCount = selected
    ? photos.filter((p) => p.assigned_person_id === selected.id).length
    : 0;

  const albumUrl = data?.event?.public_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/album/${data.event.public_token}`
    : "";

  useEffect(() => {
    let cancelled = false;
    if (!galleryUrl || assignedCount === 0) {
      setQrDataUrl(null);
      return undefined;
    }
    QRCode.toDataURL(galleryUrl, { width: 512, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [galleryUrl, assignedCount]);

  useEffect(() => {
    let cancelled = false;
    if (!albumUrl) {
      setAlbumQrDataUrl(null);
      return undefined;
    }
    QRCode.toDataURL(albumUrl, { width: 512, margin: 1 }).then((url) => {
      if (!cancelled) setAlbumQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [albumUrl]);



  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="font-display text-base font-semibold">{data?.event?.name ?? ""}</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {editingTitle ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveTitle();
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold"
                  />
                  <button className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="rounded-md border border-border px-3 py-2 text-xs"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{data?.event?.name}</h1>
                  <button
                    onClick={() => {
                      setTitleDraft(data?.event?.name ?? "");
                      setEditingTitle(true);
                    }}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Rename
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {data?.event?.date ?? "No date"} · {photos.length} photos ·{" "}
                {formatGBP(
                  (data?.orders ?? []).reduce(
                    (s, o) => s + o.amount_pence - (o.refunded_pence ?? 0),
                    0,
                  ),
                )}{" "}
                earned
              </p>
            </div>
            <label className="cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Upload photos
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          >
            Drag and drop images here — previews are watermarked before they leave your machine.
          </div>

          {data?.event && (
            <div className="mt-6">
              <EventPricingCard
                eventId={eventId}
                singlePence={data.event.price_single_pence ?? 500}
                fivePence={data.event.price_five_pence ?? 2000}
                galleryPence={data.event.price_gallery_pence ?? 5000}
              />
            </div>
          )}

          {uploading && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(uploading.done / uploading.total) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploading {uploading.done} of {uploading.total}
              </p>
            </div>
          )}

          {albumUrl && (
            <div className="surface mt-6 flex flex-wrap items-center gap-6 p-5">
              <div className="shrink-0">
                {albumQrDataUrl ? (
                  <img
                    src={albumQrDataUrl}
                    alt={`QR code linking to the ${data?.event?.name ?? "event"} album`}
                    className="w-36 rounded-md bg-white p-2"
                  />
                ) : (
                  <div className="h-36 w-36 animate-pulse rounded-md bg-muted" />
                )}
              </div>
              <div className="min-w-[240px] flex-1 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Album QR — share with everyone</p>
                  <p className="text-xs text-muted-foreground">
                    Anyone who scans it lands on the full event album to preview watermarked photos
                    and pay. Downloads stay tied to each buyer&rsquo;s own purchase.
                  </p>
                </div>
                <input
                  readOnly
                  value={albumUrl}
                  className="w-full rounded-md border border-input bg-muted px-2 py-1.5 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(albumUrl)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Copy link
                  </button>
                  {albumQrDataUrl && (
                    <a
                      href={albumQrDataUrl}
                      download={`${data?.event?.name ?? "event"}-album-qr.png`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Download PNG
                    </a>
                  )}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Photos from ${data?.event?.name ?? "the event"}: ${albumUrl}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}
        </section>


        <section className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-lg font-semibold">People</h2>
            <form onSubmit={addPerson} className="mt-3 flex gap-2">
              <input
                required
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g. John"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button className="rounded-md bg-secondary px-4 py-2 text-sm font-medium">Add</button>
            </form>

            <ul className="mt-4 space-y-2">
              {people.map((p) => {
                const count = photos.filter((ph) => ph.assigned_person_id === p.id).length;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setActivePerson(p.id === activePerson ? null : p.id);
                        setQrDataUrl(null);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        activePerson === p.id
                          ? "border-primary bg-accent/50"
                          : "border-border hover:bg-accent/30"
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{count} photos</span>
                    </button>
                  </li>
                );
              })}
              {people.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No people yet. Add one, then tick their photos.
                </li>
              )}
            </ul>

            {selected && assignedCount > 0 && (
              <div className="surface mt-5 space-y-3 p-4">
                <p className="text-sm font-medium">{selected.name}&rsquo;s private gallery</p>
                <input
                  readOnly
                  value={galleryUrl}
                  className="w-full rounded-md border border-input bg-muted px-2 py-1.5 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(galleryUrl)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Copy link
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Your photos are ready: ${galleryUrl}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=Your photos&body=${encodeURIComponent(galleryUrl)}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Email
                  </a>
                </div>
                {qrDataUrl ? (
                  <div className="space-y-2">
                    <img
                      src={qrDataUrl}
                      alt={`QR code linking to ${selected.name}'s photo gallery`}
                      className="w-40 rounded-md bg-white p-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Scanning opens {selected.name}&rsquo;s gallery to preview and pay — no login.
                    </p>
                    <a
                      href={qrDataUrl}
                      download={`${selected.name}-gallery-qr.png`}
                      className="inline-block text-xs underline"
                    >
                      Download PNG
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Generating QR code…</p>
                )}

              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              Photos
              {selected && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  click to assign to {selected.name}
                </span>
              )}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p) => {
                const mine = selected && p.assigned_person_id === selected.id;
                const owner = people.find((pp) => pp.id === p.assigned_person_id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleAssign(p.id, p.assigned_person_id)}
                    className={`group relative overflow-hidden rounded-md border ${
                      mine ? "border-primary ring-2 ring-ring" : "border-border"
                    }`}
                  >
                    <img
                      src={p.url}
                      alt="Event preview"
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    {owner && (
                      <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] text-background">
                        {owner.name}
                      </span>
                    )}
                  </button>
                );
              })}
              {photos.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">No photos yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
