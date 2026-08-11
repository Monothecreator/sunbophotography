import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getTeam,
  inviteTeamMember,
  removeTeamMember,
  revokeInvitation,
  updateStudio,
} from "@/lib/studio.functions";
import { useStudio } from "@/lib/useStudio";

export const Route = createFileRoute("/_authenticated/dashboard/team")({
  head: () => ({
    meta: [
      { title: "Studio team — SunboMedia" },
      {
        name: "description",
        content: "Invite photographers to your SunboMedia studio and manage who can shoot events.",
      },
      { property: "og:title", content: "Studio team — SunboMedia" },
      { property: "og:description", content: "Manage your studio's photographers and invitations." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: studioContext } = useStudio();
  const studio = studioContext?.studio ?? null;

  const fetchTeam = useServerFn(getTeam);
  const invite = useServerFn(inviteTeamMember);
  const revoke = useServerFn(revokeInvitation);
  const removeMember = useServerFn(removeTeamMember);
  const saveStudio = useServerFn(updateStudio);

  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!studio) return;
    setName(studio.name);
    setContactEmail(studio.contact_email ?? "");
    setWebsite(studio.website ?? "");
  }, [studio]);

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam({ data: {} }),
    retry: false,
  });

  const team = teamQuery.data && !("error" in teamQuery.data) ? teamQuery.data : null;
  const teamError = teamQuery.data && "error" in teamQuery.data ? teamQuery.data.error : null;

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setInviteLink(null);
    const res = await invite({ data: { email } });
    setBusy(false);
    if ("error" in res) {
      setNotice(res.error);
      return;
    }
    setEmail("");
    setInviteLink(`${window.location.origin}/invite/${res.token}`);
    setNotice("Invitation created — share the link below with your photographer.");
    await teamQuery.refetch();
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveStudio({ data: { name, contactEmail, website } });
    setBusy(false);
    setNotice("error" in res ? res.error : "Studio details saved.");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="font-display text-base font-semibold">{studio?.name ?? "SunboMedia"}</span>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-10 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Studio team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Members can create events, upload and assign photos. Only you, the owner, can see
            revenue and withdraw funds.
          </p>
        </div>

        {notice && <p className="surface p-3 text-sm">{notice}</p>}
        {inviteLink && (
          <p className="surface break-all p-3 text-xs">
            <span className="font-medium">Invite link:</span> {inviteLink}
          </p>
        )}
        {teamError && <p className="text-sm text-destructive">{teamError}</p>}

        <section>
          <h2 className="text-lg font-semibold">Invite a photographer</h2>
          <form onSubmit={sendInvite} className="surface mt-3 flex flex-col gap-3 p-4 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              placeholder="photographer@example.com"
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Create invite
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Members</h2>
          <div className="mt-3 space-y-2">
            {teamQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {team?.members.map((m) => (
              <div key={m.userId} className="surface flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name ?? m.email ?? "Photographer"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email} · {m.role}
                  </p>
                </div>
                {m.role !== "owner" && (
                  <button
                    onClick={async () => {
                      const res = await removeMember({ data: { userId: m.userId } });
                      if ("error" in res) setNotice(res.error);
                      await teamQuery.refetch();
                    }}
                    className="rounded-md border border-border px-2 py-1.5 text-xs text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Pending invitations</h2>
          <div className="mt-3 space-y-2">
            {team && team.invitations.length === 0 && (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            )}
            {team?.invitations.map((i) => (
              <div key={i.id} className="surface flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Expires {new Date(i.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText(`${window.location.origin}/invite/${i.token}`)
                    }
                    className="rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={async () => {
                      await revoke({ data: { id: i.id } });
                      await teamQuery.refetch();
                    }}
                    className="rounded-md border border-border px-2 py-1.5 text-xs text-destructive"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Studio details</h2>
          <form onSubmit={saveDetails} className="surface mt-3 space-y-3 p-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Studio name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Contact email</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Website</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Save details
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
