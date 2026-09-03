import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAlbumDownloads } from "@/lib/album.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const searchSchema = z.object({ session_id: z.string().optional() });

export const Route = createFileRoute("/album/$token/downloads")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your Downloads — SunboMedia" },
      {
        name: "description",
        content:
          "Download the full-resolution, watermark-free photos you purchased from this SunboMedia event album.",
      },
      { property: "og:title", content: "Your Downloads — SunboMedia" },
      {
        property: "og:description",
        content: "Download the full-resolution photos you purchased.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlbumDownloads,
});

function AlbumDownloads() {
  const { token } = Route.useParams();
  const { session_id: sessionId } = Route.useSearch();
  const fetchDownloads = useServerFn(getAlbumDownloads);

  const { data, isLoading } = useQuery({
    queryKey: ["album-downloads", token, sessionId],
    enabled: !!sessionId,
    retry: false,
    queryFn: () =>
      fetchDownloads({
        data: { token, sessionId: sessionId!, environment: getStripeEnvironment() },
      }),
  });

  return (
    <main className="min-h-screen bg-background px-5 py-14">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-semibold">Your photos are ready</h1>
        <p className="mt-3 text-muted-foreground">
          {data?.eventName
            ? `Full resolution, watermark-free, from ${data.eventName}.`
            : "Full resolution and watermark-free."}
        </p>

        {!sessionId && (
          <p className="mt-8 text-muted-foreground">
            Open this page from the link in your receipt so we can find your purchase.
          </p>
        )}

        {sessionId && isLoading && <p className="mt-8 text-muted-foreground">Preparing files…</p>}

        {sessionId && data && data.photos.length === 0 && (
          <p className="mt-8 text-muted-foreground">
            We can&rsquo;t see a completed payment for this link yet. If you&rsquo;ve just paid,
            refresh in a moment.
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(data?.photos ?? []).map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              download={photo.filename}
              className="rounded-lg border border-border p-4 text-center text-sm hover:bg-accent/40"
            >
              {photo.filename}
              <span className="mt-2 block text-xs text-muted-foreground">Download</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
