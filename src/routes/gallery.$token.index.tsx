import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  confirmTestPayment,
  getGuestGallery,
  startGuestCheckout,
} from "@/lib/guest.functions";
import { formatGBP, priceForSelection } from "@/lib/pricing";

export const Route = createFileRoute("/gallery/$token/")({
  head: () => ({
    meta: [
      { title: "Your photos" },
      { name: "description", content: "Your personal photo gallery from the event." },
      { property: "og:title", content: "Your photos" },
      { property: "og:description", content: "Your personal photo gallery from the event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestGallery,
});

function GuestGallery() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fetchGallery = useServerFn(getGuestGallery);
  const checkout = useServerFn(startGuestCheckout);
  const confirm = useServerFn(confirmTestPayment);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gallery", token],
    queryFn: () => fetchGallery({ data: { token } }),
    retry: false,
  });

  const pay = useMutation({
    mutationFn: async () => {
      const order = await checkout({ data: { token, photoIds: [...selected] } });
      await confirm({ data: { token, orderId: order.orderId } });
    },
    onSuccess: () => navigate({ to: "/gallery/$token/downloads", params: { token } }),
  });

  if (isLoading) {
    return <Shell><p className="text-muted-foreground">Finding your photos…</p></Shell>;
  }
  if (error || !data) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold">This link isn&rsquo;t working</h1>
        <p className="mt-2 text-muted-foreground">
          Ask your photographer to send you a fresh link.
        </p>
      </Shell>
    );
  }

  const total = priceForSelection(selected.size, data.photos.length);

  return (
    <main className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-5xl px-5 pt-14">
        <p className="text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase">
          {data.eventName}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
          Hi {data.personName}, we found {data.photos.length}{" "}
          {data.photos.length === 1 ? "photo" : "photos"} of you
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Tap the ones you love. Previews are watermarked — your full-resolution, clean copies
          arrive the moment you check out.
        </p>

        {data.paidCount > 0 && (
          <button
            onClick={() => navigate({ to: "/gallery/$token/downloads", params: { token } })}
            className="mt-5 rounded-md border border-border px-4 py-2 text-sm"
          >
            You already own {data.paidCount} — go to downloads
          </button>
        )}

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.photos.map((photo) => {
            const isOn = selected.has(photo.id);
            return (
              <div key={photo.id} className="relative">
                <button
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(photo.id)) next.delete(photo.id);
                      else next.add(photo.id);
                      return next;
                    })
                  }
                  className={`block w-full overflow-hidden rounded-lg border ${
                    isOn ? "border-primary ring-2 ring-ring" : "border-border"
                  }`}
                >
                  <img
                    src={photo.previewUrl}
                    alt={`Preview of ${data.personName}`}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover"
                  />
                </button>
                <button
                  onClick={() => setLightbox(photo.previewUrl)}
                  className="absolute right-2 bottom-2 rounded bg-foreground/70 px-2 py-1 text-[11px] text-background"
                >
                  View
                </button>
              </div>
            );
          })}
        </div>

        {data.photos.length === 0 && (
          <p className="mt-10 text-muted-foreground">
            Your photographer hasn&rsquo;t added your photos yet — check back shortly.
          </p>
        )}
      </div>

      {data.photos.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="text-sm">
              <p className="font-medium">
                {selected.size} selected · {formatGBP(total)}
              </p>
              <button
                onClick={() => setSelected(new Set(data.photos.map((p) => p.id)))}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Buy entire gallery — {formatGBP(priceForSelection(data.photos.length, data.photos.length))}
              </button>
            </div>
            <button
              disabled={selected.size === 0 || pay.isPending}
              onClick={() => pay.mutate()}
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pay.isPending ? "Processing…" : "Continue to checkout"}
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-6"
        >
          <img src={lightbox} alt="Full preview" className="max-h-full max-w-full rounded-md" />
        </button>
      )}
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>{children}</div>
    </main>
  );
}
