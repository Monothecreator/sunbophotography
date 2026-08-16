import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/studio.functions";
import { setActiveStudioId } from "@/lib/useStudio";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a studio — SunboMedia" },
      {
        name: "description",
        content: "Accept your SunboMedia studio invitation and start shooting events with the team.",
      },
      { property: "og:title", content: "Join a studio — SunboMedia" },
      { property: "og:description", content: "Accept your SunboMedia studio invitation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvitation);
  const [state, setState] = useState<
    { kind: "working" } | { kind: "done"; studio: string } | { kind: "error"; message: string }
  >({ kind: "working" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Guests arriving from an emailed link have no session yet — send them to
      // sign in and bring them straight back here with the token intact.
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({
          to: "/auth",
          search: { redirect: `/invite/${token}` },
          replace: true,
        });
        return;
      }

      const res = await accept({ data: { token } });
      if (cancelled) return;
      if ("error" in res) {
        setState({ kind: "error", message: res.error });
        return;
      }
      setState({ kind: "done", studio: res.studioName });
      if (res.studioId) setActiveStudioId(res.studioId);
      await supabase.auth.refreshSession();
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, accept, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="surface max-w-sm p-6 text-center">
        <h1 className="font-display text-xl font-semibold">Studio invitation</h1>
        {state.kind === "working" && (
          <p className="mt-2 text-sm text-muted-foreground">Adding you to the studio…</p>
        )}
        {state.kind === "done" && (
          <p className="mt-2 text-sm text-muted-foreground">
            You've joined {state.studio}. Taking you to the dashboard…
          </p>
        )}
        {state.kind === "error" && (
          <>
            <p className="mt-2 text-sm text-destructive">{state.message}</p>
            <Link
              to="/dashboard"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
