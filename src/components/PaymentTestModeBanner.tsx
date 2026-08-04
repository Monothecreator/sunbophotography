const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Renders nothing once live payments are configured. */
export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Checkout isn&rsquo;t configured for this build yet.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-border bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
        Test mode — payments made here are not real. Use card 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
