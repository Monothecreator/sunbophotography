import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatGBP } from "@/lib/pricing";

type Props = {
  eventId: string;
  singlePence: number;
  fivePence: number;
  galleryPence: number;
};

/** Photographer-editable price tiers for one event. Enforced server-side at checkout. */
export function EventPricingCard({ eventId, singlePence, fivePence, galleryPence }: Props) {
  const qc = useQueryClient();
  const [single, setSingle] = useState(String(singlePence / 100));
  const [five, setFive] = useState(String(fivePence / 100));
  const [gallery, setGallery] = useState(String(galleryPence / 100));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const toPence = (v: string) => Math.round(parseFloat(v || "0") * 100);
    const values = {
      price_single_pence: toPence(single),
      price_five_pence: toPence(five),
      price_gallery_pence: toPence(gallery),
    };
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 100)) {
      setMessage("Each price must be at least £1.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("events").update(values).eq("id", eventId);
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Prices saved — new checkouts use them immediately.");
    qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  return (
    <section className="rounded-lg border border-border p-5">
      <h2 className="text-sm font-semibold">Pricing for this event</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guests are charged per photo, per block of five, and never more than the whole-gallery
        price. Currently {formatGBP(singlePence)} / {formatGBP(fivePence)} / {formatGBP(galleryPence)}.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="1 photo" value={single} onChange={setSingle} />
        <Field label="5 photos" value={five} onChange={setFive} />
        <Field label="Whole gallery" value={gallery} onChange={setGallery} />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save prices"}
        </button>
      </form>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-muted-foreground">
      <span className="mb-1 block">{label} (£)</span>
      <input
        type="number"
        min="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}
