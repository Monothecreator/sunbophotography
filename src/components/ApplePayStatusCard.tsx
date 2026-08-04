import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getApplePayStatus } from "@/lib/payments-status.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export function ApplePayStatusCard() {
  const check = useServerFn(getApplePayStatus);

  const { data, isLoading, error } = useQuery({
    queryKey: ["apple-pay-status"],
    queryFn: () => check({ data: { environment: getStripeEnvironment() } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Apple Pay status
      </p>
      {isLoading && <p className="mt-2 text-sm text-muted-foreground">Checking Stripe…</p>}
      {error && <p className="mt-2 text-sm text-destructive">Could not reach Stripe.</p>}
      {data && "error" in data && <p className="mt-2 text-sm text-destructive">{data.error}</p>}
      {data && !("error" in data) && (
        <div className="mt-2 space-y-2">
          <p className="font-display text-lg font-semibold">
            {data.applePayEnabled ? "Enabled" : "Not enabled"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({data.environment})
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{data.note}</p>
          <p className="text-xs text-muted-foreground">
            Registered Apple Pay domains:{" "}
            {data.registeredDomains.length ? data.registeredDomains.join(", ") : "managed by Lovable"}
          </p>
        </div>
      )}
    </div>
  );
}
