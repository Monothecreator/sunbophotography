import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatGBP } from "@/lib/pricing";
import { ApplePayStatusCard } from "@/components/ApplePayStatusCard";
import { InstallAppCard } from "@/components/InstallAppCard";
import { useStudio, useSwitchStudio } from "@/lib/useStudio";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  createPayout,
  getPayoutBalance,
  listPayouts,
  type PayoutRow,
} from "@/lib/payouts.functions";
import { useServerFn } from "@tanstack/react-start";


export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Studio dashboard — SunboMedia" },
      { name: "description", content: "Revenue, events and guest galleries for your studio." },
      { property: "og:title", content: "Studio dashboard — SunboMedia" },
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
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState("");

  const { data: studioContext, isLoading: studioLoading } = useStudio();
  const studio = studioContext?.studio ?? null;
  const isOwner = studioContext?.role === "owner";
  const memberships = studioContext?.memberships ?? [];
  const switchStudio = useSwitchStudio();


  const fetchBalance = useServerFn(getPayoutBalance);
  const doPayout = useServerFn(createPayout);
  const fetchPayouts = useServerFn(listPayouts);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", studio?.id, isOwner],
    enabled: Boolean(studio),
    queryFn: async () => {
      const [{ data: events }, ordersRes, { data: views }, { data: people }] = await Promise.all([
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        // Members are blocked from order rows by policy; skip the request entirely.
        isOwner
          ? supabase.from("orders").select("*").eq("status", "paid")
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("gallery_views").select("id, event_id"),
        supabase.from("people").select("id, event_id"),
      ]);
      return {
        events: events ?? [],
        orders: (ordersRes.data ?? []) as {
          event_id: string;
          person_id: string | null;
          amount_pence: number;
          refunded_pence: number | null;
          photo_ids: string[] | null;
        }[],
        views: views ?? [],
        people: people ?? [],
      };
    },
  });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user || !studio) return;
    const { data: created } = await supabase
      .from("events")
      .insert({
        photographer_id: user.user.id,
        studio_id: studio.id,
        name,
        date: date || null,
      })
      .select("id")
      .single();
    setName("");
    setDate("");
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (created) navigate({ to: "/dashboard/events/$eventId", params: { eventId: created.id } });
  }

  async function saveEventName(eventId: string) {
    const next = eventDraft.trim();
    if (!next) return;
    await supabase.from("events").update({ name: next }).eq("id", eventId);
    setEditingEvent(null);
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
  }

  async function deleteEvent(eventId: string, eventName: string, hasOrders: boolean) {
    if (hasOrders) {
      window.alert(
        `${eventName} has paid orders, so it can't be deleted — buyers would lose their downloads.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Delete ${eventName}? All its photos, guests and gallery links will stop working.`,
      )
    )
      return;

    const { data: photos } = await supabase
      .from("photos")
      .select("preview_path, file_path")
      .eq("event_id", eventId);

    if (photos && photos.length > 0) {
      await supabase.storage.from("previews").remove(photos.map((p) => p.preview_path));
      await supabase.storage.from("originals").remove(photos.map((p) => p.file_path));
    }
    await supabase.from("photos").delete().eq("event_id", eventId);
    await supabase.from("people").delete().eq("event_id", eventId);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      window.alert(`Could not delete ${eventName}: ${error.message}`);
    }
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  }


  const revenue = (data?.orders ?? []).reduce(
    (s, o) => s + o.amount_pence - (o.refunded_pence ?? 0),
    0,
  );
  const downloads = (data?.orders ?? []).reduce((s, o) => s + (o.photo_ids?.length ?? 0), 0);
  const customers = new Set((data?.orders ?? []).map((o) => o.person_id)).size;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2">
            {studio?.logo_url && (
              <img
                src={studio.logo_url}
                alt=""
                className="h-7 w-7 rounded-md object-cover"
                width={28}
                height={28}
              />
            )}
            {memberships.length > 1 ? (
              <select
                value={studio?.id ?? ""}
                onChange={(e) => switchStudio(e.target.value)}
                aria-label="Active studio"
                className="rounded-md border border-input bg-background px-2 py-1 font-display text-base font-semibold"
              >
                {memberships.map((m) => (
                  <option key={m.studio.id} value={m.studio.id}>
                    {m.studio.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-display text-base font-semibold">
                {studio?.name ?? "SunboMedia"}
              </span>
            )}
          </span>


          <div className="flex items-center gap-4">
          {isOwner && (
            <Link to="/dashboard/team" className="text-sm text-muted-foreground hover:text-foreground">
              Team
            </Link>
          )}
          <Link to="/dashboard/account" className="text-sm text-muted-foreground hover:text-foreground">
            Account
          </Link>
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
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {studioLoading && (
          <p className="mt-2 text-sm text-muted-foreground">Loading your studio…</p>
        )}
        {!studioLoading && !studio && (
          <p className="surface mt-4 p-4 text-sm text-destructive">
            No studio is linked to this account yet. Sign out and back in, or contact support.
          </p>
        )}

        <div className="mt-6">
          <InstallAppCard />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isOwner && <Stat label="Total revenue" value={formatGBP(revenue)} />}
          {isOwner && <Stat label="Paying customers" value={String(customers)} />}
          {isOwner && <Stat label="Photos sold" value={String(downloads)} />}
          <Stat label="Gallery views" value={String(data?.views.length ?? 0)} />
          <Stat label="Events" value={String(data?.events.length ?? 0)} />
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
                  .reduce((s, o) => s + o.amount_pence - (o.refunded_pence ?? 0), 0);
                const evViews = data.views.filter((v) => v.event_id === ev.id).length;
                const evPeople = data.people.filter((p) => p.event_id === ev.id).length;
                const hasOrders = data.orders.some((o) => o.event_id === ev.id);
                if (editingEvent === ev.id) {
                  return (
                    <form
                      key={ev.id}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEventName(ev.id);
                      }}
                      className="surface flex flex-wrap items-center gap-2 p-4"
                    >
                      <input
                        autoFocus
                        value={eventDraft}
                        onChange={(e) => setEventDraft(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <button className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEvent(null)}
                        className="rounded-md border border-border px-3 py-2 text-xs"
                      >
                        Cancel
                      </button>
                    </form>
                  );
                }
                return (
                  <div
                    key={ev.id}
                    className="surface flex items-center justify-between gap-3 p-4"
                  >
                    <Link
                      to="/dashboard/events/$eventId"
                      params={{ eventId: ev.id }}
                      className="min-w-0 flex-1 transition-colors hover:opacity-80"
                    >
                      <p className="font-medium">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.date ?? "No date"} · {evPeople} people · {evViews} views
                      </p>
                    </Link>
                    {isOwner && (
                      <span className="font-display text-lg font-semibold">
                        {formatGBP(evRevenue)}
                      </span>
                    )}
                    <div className="flex shrink-0 gap-2">
                      <button
                        aria-label={`Rename ${ev.name}`}
                        onClick={() => {
                          setEventDraft(ev.name);
                          setEditingEvent(ev.id);
                        }}
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Rename
                      </button>
                      <button
                        aria-label={`Delete ${ev.name}`}
                        onClick={() => deleteEvent(ev.id, ev.name, hasOrders)}
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
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
            {isOwner && (
              <>
                <div className="mt-8">
                  <h2 className="text-lg font-semibold">Payments</h2>
                  <div className="mt-3">
                    <ApplePayStatusCard />
                  </div>
                </div>
                <div className="mt-8">
                  <h2 className="text-lg font-semibold">Withdraw funds</h2>
                  <div className="mt-3">
                    <PayoutsCard
                      fetchBalance={fetchBalance}
                      doPayout={doPayout}
                      fetchPayouts={fetchPayouts}
                    />
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PayoutsCard({
  fetchBalance,
  doPayout,
  fetchPayouts,
}: {
  fetchBalance: ReturnType<typeof useServerFn<typeof getPayoutBalance>>;
  doPayout: ReturnType<typeof useServerFn<typeof createPayout>>;
  fetchPayouts: ReturnType<typeof useServerFn<typeof listPayouts>>;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [result, setResult] = useState<
    | { type: "success"; payoutId: string; amountPence: number; status: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const balanceQuery = useQuery({
    queryKey: ["payout-balance"],
    queryFn: () => fetchBalance({ data: { environment: getStripeEnvironment() } }),
    retry: false,
    staleTime: 60 * 1000,
  });

  const payoutsQuery = useQuery({
    queryKey: ["payouts-list"],
    queryFn: () => fetchPayouts({ data: {} }),
    retry: false,
    staleTime: 60 * 1000,
  });

  async function withdraw() {
    if (withdrawing) return;
    setWithdrawing(true);
    setResult(null);
    try {
      const res = await doPayout({ data: { environment: getStripeEnvironment() } });
      if ("error" in res) {
        setResult({ type: "error", message: res.error });
      } else {
        setResult({
          type: "success",
          payoutId: res.stripePayoutId,
          amountPence: res.amountPence,
          status: res.status,
        });
        await Promise.all([
          balanceQuery.refetch(),
          payoutsQuery.refetch(),
        ]);
      }
    } finally {
      setWithdrawing(false);
    }
  }

  const balance = balanceQuery.data && !("error" in balanceQuery.data)
    ? balanceQuery.data
    : null;
  const payouts = payoutsQuery.data && !("error" in payoutsQuery.data)
    ? payoutsQuery.data.payouts
    : [];

  return (
    <div className="surface p-4">
      {balanceQuery.isLoading && <p className="text-sm text-muted-foreground">Loading balance…</p>}
      {balanceQuery.data && "error" in balanceQuery.data && (
        <p className="text-sm text-destructive">{balanceQuery.data.error}</p>
      )}
      {balance && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Available to withdraw
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{formatGBP(balance.availablePence)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="font-medium">{formatGBP(balance.pendingPence)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instant available</p>
              <p className="font-medium">{formatGBP(balance.instantAvailablePence)}</p>
            </div>
          </div>
          <button
            onClick={withdraw}
            disabled={withdrawing || balance.availablePence <= 0}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {withdrawing ? "Withdrawing…" : "Withdraw available balance"}
          </button>
          <p className="text-xs text-muted-foreground">
            Withdrawals send the full available balance to your connected bank account. If your
            Stripe account uses automatic payouts, withdrawals are handled automatically and the
            button will show Stripe's response.
          </p>
        </div>
      )}

      {result?.type === "success" && (
        <div className="mt-4 rounded-md bg-green-100 p-3 text-sm text-green-800">
          <p className="font-medium">Withdrawal started</p>
          <p className="mt-1">
            {formatGBP(result.amountPence)} · Stripe payout {result.payoutId} · {result.status}
          </p>
        </div>
      )}
      {result?.type === "error" && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Could not withdraw</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recent withdrawals
          </p>
          <ul className="mt-2 space-y-2">
            {payouts.map((p: PayoutRow) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                <span className="font-medium">{formatGBP(p.amount_pence)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    p.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : p.status === "in_transit"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
