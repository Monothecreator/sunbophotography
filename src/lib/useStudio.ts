import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StudioRole = "owner" | "member";

export type Studio = {
  id: string;
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  website: string | null;
  slug: string;
};

export type StudioContext = { studio: Studio; role: StudioRole } | null;

/**
 * The signed-in user's studio and their role in it. Every photographer gets a
 * studio on signup (database trigger), so this normally resolves immediately.
 */
export function useStudio() {
  return useQuery<StudioContext>({
    queryKey: ["studio"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const { data } = await supabase
        .from("studio_members")
        .select("role, studios(id, name, logo_url, contact_email, website, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!data?.studios) return null;
      return {
        role: data.role as StudioRole,
        studio: data.studios as unknown as Studio,
      };
    },
  });
}
