import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      console.log("Auth check - Error:", error, "User:", data.user?.email);
      
      if (error || !data.user) {
        console.log("No user found, redirecting to auth");
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
      console.log("✓ User authenticated:", data.user.email);
      return { user: data.user };
    } catch (err) {
      if (err instanceof Error && "code" in err) {
        // This is a redirect, re-throw it
        throw err;
      }
      console.error("Unexpected error in beforeLoad:", err);
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
