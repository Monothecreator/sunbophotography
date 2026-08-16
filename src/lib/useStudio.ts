import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export type StudioMembership = { studio: Studio; role: StudioRole };

export type StudioContext =
  | (StudioMembership & { memberships: StudioMembership[] })
  | null;

const ACTIVE_STUDIO_KEY = "sunbo.activeStudioId";

export function getActiveStudioId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_STUDIO_KEY);
}

export function setActiveStudioId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_STUDIO_KEY, id);
}

/**
 * The signed-in user's studios and their role in the active one. A photographer
 * always has their own studio, and may join others through an invitation — the
 * active studio is remembered locally so joining actually changes the dashboard.
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
        .order("created_at", { ascending: true });

      const memberships: StudioMembership[] = (data ?? [])
        .filter((row) => row.studios)
        .map((row) => ({
          role: row.role as StudioRole,
          studio: row.studios as unknown as Studio,
        }));

      if (!memberships.length) return null;

      const activeId = getActiveStudioId();
      const active = memberships.find((m) => m.studio.id === activeId) ?? memberships[0]!;
      return { ...active, memberships };
    },
  });
}

export function useSwitchStudio() {
  const qc = useQueryClient();
  return (studioId: string) => {
    setActiveStudioId(studioId);
    qc.invalidateQueries({ queryKey: ["studio"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}
