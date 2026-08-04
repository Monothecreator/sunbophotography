import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { getAlbumCheckoutStatus } from "@/lib/album.functions";
import { formatGBP } from "@/lib/pricing";
import { getStripeEnvironment } from "@/lib/stripe";

const searchSchema = z.object({ session_id: z.string().optional() });

export const Route = createFileRoute("/album/$token/status")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Payment status" },
      { name: "description", content: "Confirming your album purchase." },
      { property: "og:title", content: "Payment status" },
      { property: "og:description", content: "Confirming your album purchase." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlbumStatus,
});

function AlbumStatus() {
  const { token } = Route.useParams();
  const { session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getAlbumCheckoutStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["album-status", token, sessionId],
    enabled: !!sessionId,
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
    queryFn: () =>
      fetchStatus({
        data: { token, sessionId: sessionId!, environment: getStripeEnvironment() },
      }),
  });

  useEffect(() => {
    if (data?.status === "paid" && sessionId) {
      const t = setTimeout(
        () =>
          navigate({
            to: "/album/$token/downloads",
            params: { token },
            search: { session_id: sessionId },
          }),
        1200,
      );
      return () => clearTimeout(t);
    }
  }, [data?.status, navigate, sessionId, token]);

  if (!sessionId) {
    return (
      <Shell title="Nothing to confirm">
        <p className="text-muted-foreground">This page needs a checkout link from Stripe.</p>
      </Shell>
    );
  }

  if (isLoading || !data) {
    return (
      <Shell title="Checking your payment…">
        <p className="text-muted-foreground">One moment while we confirm with the bank.</p>
      </Shell>
    );
  }

  return (
    <Shell
      title={
        data.status === "paid"
          ? "Payment confirmed"
          : data.status === "failed"
            ? "Payment didn't complete"
            : "Still confirming"
      }
    >
      <p className="text-muted-foreground">{data.message}</p>
      {data.photoCount > 0 && (
        <p className="mt-4 text-sm">
          {data.photoCount} {data.photoCount === 1 ? "photo" : "photos"} from {data.eventName} ·{" "}
          {formatGBP(data.amountPence)}
        </p>
      )}
      {data.status === "paid" && (
        <p className="mt-6 text-sm text-muted-foreground">Taking you to your downloads…</p>
      )}
      {data.status === "failed" && (
        <button
          onClick={() => navigate({ to: "/album/$token", params: { token } })}
          className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to the album
        </button>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <div className="mt-3">{children}</div>
      </div>
    </main>
  );
}
