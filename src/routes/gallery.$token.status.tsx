import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getGuestCheckoutStatus } from "@/lib/guest.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/gallery/$token/status")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment status" },
      { name: "description", content: "Checking your payment before your photos unlock." },
      { property: "og:title", content: "Payment status" },
      { property: "og:description", content: "Checking your payment before your photos unlock." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentStatus,
});

function formatAmount(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function PaymentStatus() {
  const { token } = Route.useParams();
  const { session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const checkStatus = useServerFn(getGuestCheckoutStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["checkout-status", token, sessionId],
    enabled: Boolean(sessionId),
    // Keep polling while a slow payment method (bank debit, etc.) clears.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
    queryFn: () =>
      checkStatus({
        data: { token, sessionId: sessionId!, environment: getStripeEnvironment() },
      }),
  });

  const status = data?.status;

  useEffect(() => {
    if (status !== "paid") return;
    const t = setTimeout(
      () => navigate({ to: "/gallery/$token/downloads", params: { token } }),
      1200,
    );
    return () => clearTimeout(t);
  }, [status, navigate, token]);

  const tone =
    status === "paid"
      ? { dot: "bg-emerald-500", title: "Payment confirmed" }
      : status === "failed"
        ? { dot: "bg-destructive", title: "Payment didn't complete" }
        : status === "unknown"
          ? { dot: "bg-muted-foreground", title: "We couldn't find that payment" }
          : { dot: "bg-amber-500 animate-pulse", title: "Payment in progress" };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 py-16">
        <Link
          to="/gallery/$token"
          params={{ token }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to your gallery
        </Link>

        <div className="surface mt-6 p-8">
          {!sessionId ? (
            <>
              <h1 className="font-display text-2xl font-semibold">No payment to check</h1>
              <p className="mt-2 text-muted-foreground">
                This page opens automatically after a checkout.
              </p>
            </>
          ) : isLoading ? (
            <p className="text-muted-foreground">Checking your payment…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`size-2.5 rounded-full ${tone.dot}`} aria-hidden />
                <h1 className="font-display text-2xl font-semibold">{tone.title}</h1>
              </div>

              <p className="mt-3 text-muted-foreground">{data?.message}</p>

              {(data?.photoCount ?? 0) > 0 && (
                <dl className="mt-6 grid gap-2 text-sm">
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Photos</dt>
                    <dd>{data?.photoCount}</dd>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <dt className="text-muted-foreground">Total</dt>
                    <dd>{formatAmount(data?.amountPence ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Gallery</dt>
                    <dd>{data?.eventName}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                {status === "paid" && (
                  <Link
                    to="/gallery/$token/downloads"
                    params={{ token }}
                    className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    Go to your downloads
                  </Link>
                )}
                {status !== "paid" && (
                  <Link
                    to="/gallery/$token"
                    params={{ token }}
                    className="rounded-md border border-border px-5 py-2.5 text-sm"
                  >
                    {status === "pending" ? "Keep browsing" : "Try again"}
                  </Link>
                )}
              </div>

              {status === "pending" && (
                <p className="mt-4 text-xs text-muted-foreground">
                  This page updates on its own — downloads unlock the moment the payment clears.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
