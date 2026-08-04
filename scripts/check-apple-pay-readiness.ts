/**
 * Apple Pay readiness preflight — step 0 of docs/apple-pay-e2e-checklist.md.
 *
 * Usage: bun run scripts/check-apple-pay-readiness.ts [sandbox|live]
 */
import { createStripeClient, type StripeEnv } from "../src/lib/stripe.server";

const arg = process.argv[2] ?? "sandbox";
if (arg !== "sandbox" && arg !== "live") {
  console.error("Usage: bun run scripts/check-apple-pay-readiness.ts [sandbox|live]");
  process.exit(1);
}
const env: StripeEnv = arg;

const stripe = createStripeClient(env);

const configs = await stripe.paymentMethodConfigurations.list({ limit: 10 });
const active = configs.data.find((c) => c.active) ?? configs.data[0];
const applePay = active?.apple_pay;
const enabled = Boolean(applePay?.available && applePay?.display_preference?.value === "on");

let domains: string[] = [];
try {
  const list = await stripe.applePayDomains.list({ limit: 20 });
  domains = list.data.map((d) => d.domain_name);
} catch {
  domains = [];
}

console.log(`environment:            ${env}`);
console.log(`configuration:          ${active?.name ?? "none"}`);
console.log(`apple pay available:    ${applePay?.available ?? false}`);
console.log(`display preference:     ${applePay?.display_preference?.value ?? "unset"}`);
console.log(`registered domains:     ${domains.length ? domains.join(", ") : "managed by Lovable"}`);
console.log(`\nresult: ${enabled ? "PASS — Apple Pay will render on Safari/iOS" : "FAIL — Apple Pay is off for this account"}`);

process.exit(enabled ? 0 : 1);
