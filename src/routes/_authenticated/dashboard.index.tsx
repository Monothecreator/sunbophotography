import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatGBP } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Studio dashboard — Aperture&Ember" },
      { name: "description", content: "Revenue, events and guest galleries for your studio." },
      { property: "og:title", content: "Studio dashboard — Aperture&Ember" },
      { property: "og:description", content: "Revenue, events and guest galleries." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [{ data: events }, { data: orders }, { data: views }, { data: people }] =
        await Promise.all([
          supabase.from("events").select("*").order("created_at", { ascending: false }),
          supabase.from("orders").select("*").eq("status", "paid"),
          supabase.from("gallery_views").select("id, event_id"),
          supabase.from("people").select("id, event_id"),
        ]);
      return {
        events: events ?? [],
        orders: orders ?? [],
        views: views ?? [],
        people: people ?? [],
      };
    },
  });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: created } = await supabase
      .from("events")
      .insert({ photographer_id: user.user.id, name, date: date || null })
      .select("id")
      .single();
    setName("");
    setDate("");
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (created) navigate({ to: "/dashboard/events/$eventId", params: { eventId: created.id } });
  }

  const revenue = (data?.orders ?? []).reduce((s, o) => s + o.amount_pence, 0);
  const downloads = (data?.orders ?? []).reduce((s, o) => s + (o.photo_ids?.length ?? 0), 0);
  const customers = new Set((data?.orders ?? []).map((o) => o.person_id)).size;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-base font-semibold">Aperture&amp;Ember Studio</span>
          <button
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total revenue" value={formatGBP(revenue)} />
          <Stat label="Paying customers" value={String(customers)} />
          <Stat label="Photos sold" value={String(downloads)} />
          <Stat label="Gallery views" value={String(data?.views.length ?? 0)} />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section>
            <h2 className="text-lg font-semibold">Events</h2>
            <div className="mt-3 space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && data?.events.length === 0 && (
                <p className="surface p-6 text-sm text-muted-foreground">
                  No events yet — create your first one to start uploading.
                </p>
              )}
              {data?.events.map((ev) => {
                const evRevenue = data.orders
                  .filter((o) => o.event_id === ev.id)
                  .reduce((s, o) => s + o.amount_pence, 0);
                const evViews = data.views.filter((v) => v.event_id === ev.id).length;
                const evPeople = data.people.filter((p) => p.event_id === ev.id).length;
                return (
                  <Link
                    key={ev.id}
                    to="/dashboard/events/$eventId"
                    params={{ eventId: ev.id }}
                    className="surface flex items-center justify-between p-4 transition-colors hover:bg-accent/40"
                  >
                    <div>
                      <p className="font-medium">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.date ?? "No date"} · {evPeople} people · {evViews} views
                      </p>
                    </div>
                    <span className="font-display text-lg font-semibold">
                      {formatGBP(evRevenue)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">New event</h2>
            <form onSubmit={createEvent} className="surface mt-3 space-y-3 p-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Event name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Create event
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
