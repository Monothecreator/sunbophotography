import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";


export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] as string } : {},

  head: () => ({
    meta: [
      { title: "Photographer sign in — SunboMedia" },
      {
        name: "description",
        content: "Sign in or create your SunboMedia photographer account to manage events.",
      },
      { property: "og:title", content: "Photographer sign in — SunboMedia" },
      { property: "og:description", content: "Access your SunboMedia studio dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setRecovering] = useState(false);

  useEffect(() => {
    // A recovery link drops the user here with a live session; send them to
    // account settings to set a new password instead of bouncing to the dashboard.
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecovering(true);
      navigate({ to: "/dashboard/account", replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function sendReset() {
    if (!email) {
      setMessage("Enter your email above first, then tap reset.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    setMessage(
      error ? error.message : "If that email has an account, a reset link is on its way.",
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, business_name: businessName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("login");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Google and email/password resolve to the SAME account when the email
  // matches (Supabase links the identities), so the profile row may already
  // exist. Fill only what's missing — never overwrite the studio's details.
  async function ensureProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, name, business_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const metaName =
      (user.user_metadata?.["name"] as string | undefined) ??
      (user.user_metadata?.["full_name"] as string | undefined) ??
      null;
    if (!existing) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? null,
        name: metaName,
        business_name: (user.user_metadata?.["business_name"] as string | undefined) ?? null,
      });
      return;
    }
    const patch: { name?: string; email?: string } = {};
    if (!existing.name && metaName) patch.name = metaName;
    if (!existing.email && user.email) patch.email = user.email;
    if (Object.keys(patch).length) {
      await supabase.from("profiles").update(patch).eq("id", user.id);
    }
  }

  async function signInWithGoogle() {

    setBusy(true);
    setMessage(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) {
        setMessage(result.error.message ?? "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Session is set by the helper — wait for it before leaving the page.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage("Google sign-in did not complete. Please try again.");
        setBusy(false);
        return;
      }
      await ensureProfile();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }




  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold">
          SunboMedia — Photographer Sign In
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login" ? "Sign in to your studio." : "Create your studio account."}
        </p>

        <div className="surface mt-6 space-y-4 p-6">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.08 7.94-2.93l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12 12 0 0 0 0 10.74l4.01-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.18 15.23 0 12 0A12 12 0 0 0 1.28 6.63l4.01 3.1C6.23 6.89 8.88 4.77 12 4.77z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">

          {mode === "signup" && (
            <>
              <Field label="Your name" value={name} onChange={setName} />
              <Field label="Business name" value={businessName} onChange={setBusinessName} />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            required
          />

          {message && <p className="text-sm text-destructive">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              onClick={sendReset}
              disabled={busy}
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot your password?
            </button>
          )}
          </form>
        </div>


        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
