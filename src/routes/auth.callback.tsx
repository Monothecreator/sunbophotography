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
        console.log("🔄 OAuth callback: exchanging code for session...");
        
        // Explicitly exchange the code from the URL for a session
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (error) {
          console.error("❌ Code exchange failed:", error);
          navigate({ to: "/auth", replace: true });
          return;
        }
        
        // Get the newly-created session to confirm
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          console.error("❌ No session after code exchange");
          navigate({ to: "/auth", replace: true });
          return;
        }
        
        console.log("✓ Session established:", data.session.user?.email);
        console.log("✓ Redirecting to dashboard...");
        
        // Navigate to dashboard now that session exists
        navigate({ to: "/dashboard", replace: true });
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
