import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Give Supabase time to fully initialize the session after OAuth redirect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data, error } = await supabase.auth.getUser();
    // Keep the requested page so sign-in can send the photographer back to it.
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
