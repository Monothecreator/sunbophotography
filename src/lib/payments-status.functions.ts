import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

export type ApplePayStatus =
  | {
      environment: StripeEnv;
      applePayEnabled: boolean;
      configurationName: string | null;
      registeredDomains: string[];
      note: string;
    }
  | { error: string };

/**
 * Internal check: is Apple Pay actually switched on for this Stripe account,
 * and which domains are registered for Apple Pay wallet rendering?
 */
export const getApplePayStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data }): Promise<ApplePayStatus> => {
    try {
      const stripe = createStripeClient(data.environment);

      const configs = await stripe.paymentMethodConfigurations.list({ limit: 10 });
      const active = configs.data.find((c) => c.active) ?? configs.data[0];
      const applePay = active?.apple_pay;
      const applePayEnabled = Boolean(applePay?.display_preference?.value === "on" || applePay?.available);

      let registeredDomains: string[] = [];
      try {
        const domains = await stripe.applePayDomains.list({ limit: 20 });
        registeredDomains = domains.data.map((d) => d.domain_name);
      } catch {
        // Domain registration is managed for Lovable-hosted domains; listing can be
        // unavailable on the connected account. Treat as "unknown", not a failure.
        registeredDomains = [];
      }

      return {
        environment: data.environment,
        applePayEnabled,
        configurationName: active?.name ?? null,
        registeredDomains,
        note: applePayEnabled
          ? "Apple Pay is enabled. It renders in Checkout only on Safari/iOS with a card in Wallet."
          : "Apple Pay is not currently enabled for this Stripe account's payment method configuration.",
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
