import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aperture&Ember — Deliver event photos to the people in them" },
      {
        name: "description",
        content:
          "Upload an event, match photos to each guest, and send them a private QR gallery they can preview and buy in seconds.",
      },
      { property: "og:title", content: "Aperture&Ember — Event photo delivery" },
      {
        property: "og:description",
        content: "Private QR galleries, watermarked previews, paid full-resolution downloads.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold tracking-tight">Aperture&amp;Ember</span>
        <Link
          to="/auth"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Photographer sign in
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Event photo delivery
        </p>
        <h1 className="mt-5 text-4xl leading-tight font-semibold sm:text-6xl">
          Every guest gets only their photos.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Upload an event, tag the people in the frames, and hand each one a private QR gallery.
          They preview watermarked shots and pay to unlock full resolution — nothing before.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start as a photographer
          </Link>
        </div>

        <dl className="mt-20 grid gap-5 text-left sm:grid-cols-3">
          {[
            ["Bulk upload", "Drag in a whole card of images with live progress."],
            ["Per-person QR", "An unguessable link per guest — no logins, ever."],
            ["Paid unlock", "Originals stay private until that photo is bought."],
          ].map(([title, body]) => (
            <div key={title} className="surface p-5">
              <dt className="font-display text-base font-semibold">{title}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
