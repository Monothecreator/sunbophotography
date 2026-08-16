import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TeamMember {
  userId: string;
  email: string | null;
  name: string | null;
  role: "owner" | "member";
  joinedAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

async function requireOwnedStudio(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("studio_members")
    .select("studio_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not verify your studio.");
  if (!data) throw new Error("Only the studio owner can manage the team.");
  return data.studio_id as string;
}

export const getTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, never>) => data)
  .handler(
    async ({
      context,
    }): Promise<
      { members: TeamMember[]; invitations: TeamInvitation[] } | { error: string }
    > => {
      try {
        const studioId = await requireOwnedStudio(context.supabase, context.userId);

        const { data: memberRows } = await context.supabase
          .from("studio_members")
          .select("user_id, role, created_at")
          .eq("studio_id", studioId)
          .order("created_at", { ascending: true });

        const { data: inviteRows } = await context.supabase
          .from("studio_invitations")
          .select("id, email, token, expires_at, created_at")
          .eq("studio_id", studioId)
          .is("accepted_at", null)
          .order("created_at", { ascending: false });

        const ids = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profiles } = ids.length
          ? await supabaseAdmin.from("profiles").select("id, email, name").in("id", ids)
          : { data: [] as { id: string; email: string | null; name: string | null }[] };

        const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

        return {
          members: (memberRows ?? []).map(
            (m: { user_id: string; role: string; created_at: string }) => ({
              userId: m.user_id,
              email: byId.get(m.user_id)?.email ?? null,
              name: byId.get(m.user_id)?.name ?? null,
              role: m.role as "owner" | "member",
              joinedAt: m.created_at,
            }),
          ),
          invitations: (inviteRows ?? []).map(
            (i: {
              id: string;
              email: string;
              token: string;
              expires_at: string;
              created_at: string;
            }) => ({
              id: i.id,
              email: i.email,
              token: i.token,
              expiresAt: i.expires_at,
              createdAt: i.created_at,
            }),
          ),
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not load your team." };
      }
    },
  );

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) => {
    const email = data.email?.trim().toLowerCase() ?? "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    return { email };
  })
  .handler(async ({ data, context }): Promise<{ token: string } | { error: string }> => {
    try {
      const studioId = await requireOwnedStudio(context.supabase, context.userId);
      const { data: row, error } = await context.supabase
        .from("studio_invitations")
        .insert({ studio_id: studioId, email: data.email, invited_by: context.userId })
        .select("token")
        .single();
      if (error || !row) return { error: "Could not create the invitation." };
      return { token: row.token as string };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not invite." };
    }
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const studioId = await requireOwnedStudio(context.supabase, context.userId);
      const { error } = await context.supabase
        .from("studio_invitations")
        .delete()
        .eq("id", data.id)
        .eq("studio_id", studioId);
      if (error) return { error: "Could not revoke the invitation." };
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not revoke." };
    }
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const studioId = await requireOwnedStudio(context.supabase, context.userId);
      if (data.userId === context.userId) return { error: "You cannot remove yourself." };
      const { error } = await context.supabase
        .from("studio_members")
        .delete()
        .eq("studio_id", studioId)
        .eq("user_id", data.userId);
      if (error) return { error: "Could not remove that member." };
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not remove." };
    }
  });

export const updateStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; contactEmail: string; website: string }) => {
    const name = data.name?.trim() ?? "";
    if (name.length < 2) throw new Error("Studio name is too short.");
    return {
      name,
      contactEmail: data.contactEmail?.trim() ?? "",
      website: data.website?.trim() ?? "",
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    try {
      const studioId = await requireOwnedStudio(context.supabase, context.userId);
      const { error } = await context.supabase
        .from("studios")
        .update({
          name: data.name,
          contact_email: data.contactEmail || null,
          website: data.website || null,
        })
        .eq("id", studioId);
      if (error) return { error: "Could not save your studio details." };
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not save." };
    }
  });

/**
 * Joining a studio happens before the caller is a member, so RLS cannot see the
 * invitation row — validate the token with the service-role client instead.
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!data.token || data.token.length < 16) throw new Error("Invalid invitation link.");
    return data;
  })
  .handler(
    async ({ data, context }): Promise<{ studioName: string; studioId: string } | { error: string }> => {

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: invite } = await supabaseAdmin
        .from("studio_invitations")
        .select("id, studio_id, role, expires_at, accepted_at, studios(name)")
        .eq("token", data.token)
        .maybeSingle();

      if (!invite) return { error: "This invitation link is not valid." };
      if (invite.accepted_at) return { error: "This invitation has already been used." };
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return { error: "This invitation has expired. Ask the studio owner for a new one." };
      }

      const { error: memberError } = await supabaseAdmin
        .from("studio_members")
        .upsert(
          { studio_id: invite.studio_id, user_id: context.userId, role: invite.role },
          { onConflict: "studio_id,user_id" },
        );
      if (memberError) return { error: "Could not add you to that studio." };

      await supabaseAdmin
        .from("studio_invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      const studioName =
        (invite as unknown as { studios?: { name?: string } }).studios?.name ?? "the studio";
      return { studioName };
    },
  );
