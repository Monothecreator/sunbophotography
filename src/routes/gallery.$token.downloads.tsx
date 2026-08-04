import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGuestDownloads, settleGuestCheckout } from "@/lib/guest.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/gallery/$token/downloads")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Downloads — Aperture&Ember" },
      {
        name: "description",
        content:
          "Download the full-resolution, watermark-free photos you purchased from your Aperture&Ember event gallery.",
      },
      { property: "og:title", content: "Your Downloads — Aperture&Ember" },
      { property: "og:description", content: "Your full-resolution photos, ready to keep." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Downloads,
});

function Downloads() {
  const { token } = Route.useParams();
  const { session_id: sessionId } = Route.useSearch();
  const fetchDownloads = useServerFn(getGuestDownloads);
  const settle = useServerFn(settleGuestCheckout);

  // Stripe returns here right after payment. Confirm settlement with Stripe
  // server-side (the webhook does the same, whichever lands first wins).
  const { isLoading: settling } = useQuery({
    queryKey: ["settle", token, sessionId],
    enabled: Boolean(sessionId),
    retry: 3,
    retryDelay: 1500,
    queryFn: async () => {
      const result = await settle({
        data: { token, sessionId: sessionId!, environment: getStripeEnvironment() },
      });
      if (!result.paid) throw new Error("Payment still processing");
      return result;
    },
  });

  const { data, isLoading: loadingFiles } = useQuery({
    queryKey: ["downloads", token, sessionId],
    queryFn: () => fetchDownloads({ data: { token } }),
    enabled: !settling,
    retry: false,
  });

  const isLoading = settling || loadingFiles;

  async function downloadAll() {
    for (const photo of data?.photos ?? []) {
      const a = document.createElement("a");
      a.href = photo.url;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-14">
        <Link
          to="/gallery/$token"
          params={{ token }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to your gallery
        </Link>

        <h1 className="mt-5 font-display text-3xl font-semibold">Thank you, {data?.personName}</h1>
        <p className="mt-2 text-muted-foreground">
          Your photos are clean, full resolution and yours to keep.
        </p>

        {isLoading && <p className="mt-8 text-muted-foreground">Preparing your files…</p>}

        {!isLoading && (data?.photos.length ?? 0) === 0 && (
          <p className="mt-8 text-muted-foreground">
            Nothing here yet — photos appear once your purchase is complete.
          </p>
        )}

        {(data?.photos.length ?? 0) > 0 && (
          <>
            <button
              onClick={downloadAll}
              className="mt-6 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Download all ({data?.photos.length})
            </button>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {data?.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="surface flex items-center justify-between gap-3 p-4 text-sm"
                >
                  <span className="truncate">{photo.filename}</span>
                  <a
                    href={photo.url}
                    download={photo.filename}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
