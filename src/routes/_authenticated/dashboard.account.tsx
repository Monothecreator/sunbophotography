import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/account")({
  head: () => ({
    meta: [
      { title: "Account settings — SunboMedia" },
      {
        name: "description",
        content: "Update your studio profile details and change your SunboMedia password.",
      },
      { property: "og:title", content: "Account settings — SunboMedia" },
      { property: "og:description", content: "Manage your studio profile and password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setEmail(auth.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, business_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      setName(profile?.name ?? "");
      setBusinessName(profile?.business_name ?? "");
      setLoading(false);
    })();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileMsg(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name, business_name: businessName })
      .eq("id", auth.user.id);
    setBusy(false);
    setProfileMsg(error ? error.message : "Profile updated.");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (password.length < 8) {
      setPasswordMsg("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setPasswordMsg("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setPassword("");
    setConfirm("");
    setPasswordMsg(error ? error.message : "Password changed.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="font-display text-base font-semibold">Account</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Account settings</h1>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your details…</p>
        ) : (
          <>
            <section className="rounded-lg border border-border p-6">
              <h2 className="text-sm font-semibold">Studio profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your business name is used as the watermark on guest previews.
              </p>
              <form onSubmit={saveProfile} className="mt-4 space-y-3">
                <Input label="Email" value={email} onChange={() => {}} disabled />
                <Input label="Your name" value={name} onChange={setName} />
                <Input label="Business name" value={businessName} onChange={setBusinessName} />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Save profile
                </button>
                {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
              </form>
            </section>

            <section className="rounded-lg border border-border p-6">
              <h2 className="text-sm font-semibold">Change password</h2>
              <form onSubmit={changePassword} className="mt-4 space-y-3">
                <Input label="New password" value={password} onChange={setPassword} type="password" />
                <Input label="Confirm password" value={confirm} onChange={setConfirm} type="password" />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Update password
                </button>
                {passwordMsg && <p className="text-sm text-muted-foreground">{passwordMsg}</p>}
              </form>
            </section>

            <button
              onClick={signOut}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
      />
    </label>
  );
}
