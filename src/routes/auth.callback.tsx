import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("🔄 OAuth callback received, setting up listener for session...");
        
        // Set up a listener that will fire when the session is ready
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "INITIAL_SESSION" && session) {
            console.log("✓ INITIAL_SESSION fired with session:", session.user?.email);
            listener.subscription.unsubscribe();
            navigate({ to: "/dashboard", replace: true });
          } else if (event === "SIGNED_IN" && session) {
            console.log("✓ SIGNED_IN fired with session:", session.user?.email);
            listener.subscription.unsubscribe();
            navigate({ to: "/dashboard", replace: true });
          }
        });

        // Wait for Supabase to parse the access_token from the URL hash
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Also explicitly check for session
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          console.log("✓ Found session via getSession():", data.session.user?.email);
          listener.subscription.unsubscribe();
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        
        // If no session yet, wait a bit more for the listener to fire
        console.log("⏳ Waiting for auth state change listener to fire...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Last check
        const { data: data2 } = await supabase.auth.getSession();
        if (!data2.session) {
          console.error("❌ No session found after 3 seconds, localStorage keys:", Object.keys(localStorage).filter(k => k.includes('sb-')));
          listener.subscription.unsubscribe();
          navigate({ to: "/auth", replace: true });
          return;
        }
      } catch (err) {
        console.error("❌ Callback error:", err);
        navigate({ to: "/auth", replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Signing you in...</h1>
        <p className="mt-2 text-muted-foreground">Please wait while we complete your authentication.</p>
      </div>
    </div>
  );
}

