import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function parseHashFragment(hash: string) {
  // Parse fragment like: #access_token=eyJ...&expires_at=1234&expires_in=3600&refresh_token=abc&token_type=bearer
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return {
    access_token: fragment.get("access_token"),
    refresh_token: fragment.get("refresh_token"),
    expires_at: fragment.get("expires_at") ? parseInt(fragment.get("expires_at")!) : undefined,
    expires_in: fragment.get("expires_in") ? parseInt(fragment.get("expires_in")!) : undefined,
    token_type: fragment.get("token_type"),
  };
}

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("🔄 OAuth callback: parsing hash tokens...");
        console.log("📍 Current URL:", window.location.href);
        
        // Parse tokens from hash
        const tokens = parseHashFragment(window.location.hash);
        console.log("📦 Parsed tokens:", {
          access_token: tokens.access_token ? `${tokens.access_token.slice(0, 20)}...` : null,
          refresh_token: tokens.refresh_token ? "yes" : "no",
          expires_in: tokens.expires_in,
        });
        
        if (!tokens.access_token) {
          console.error("❌ No access_token found in URL hash");
          navigate({ to: "/auth", replace: true });
          return;
        }
        
        // Set the session with the tokens from the hash
        console.log("💾 Setting session with tokens...");
        const { data: setData, error: setError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || "",
        });
        
        if (setError) {
          console.error("❌ Error setting session:", setError);
          navigate({ to: "/auth", replace: true });
          return;
        }
        
        console.log("✓ Session set, verifying...");
        
        // Verify session was actually set
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          console.log("✓ Session confirmed:", sessionData.session.user?.email);
          console.log("✓ localStorage keys:", Object.keys(localStorage).filter(k => k.includes("sb-")));
          
          // Navigate to dashboard
          navigate({ to: "/dashboard", replace: true });
        } else {
          console.error("❌ Session not confirmed after setSession");
          navigate({ to: "/auth", replace: true });
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

