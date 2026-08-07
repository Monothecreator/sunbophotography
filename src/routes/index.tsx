import { createFileRoute, Link } from "@tanstack/react-router";

import { HeroSlideshow } from "@/components/home/HeroSlideshow";
import { PhotoMarquee } from "@/components/home/PhotoMarquee";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SunboMedia — Deliver event photos to the people in them" },
      {
        name: "description",
        content:
          "Upload an event, match photos to each guest, and send them a private QR gallery they can preview and buy in seconds.",
      },
      {
        property: "og:title",
        content: "SunboMedia — Deliver event photos to the people in them",
      },
      {
        property: "og:description",
        content: "Private QR galleries, watermarked previews, paid full-resolution downloads.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "SunboMedia",
          url: "/",
          description: "Event photo delivery for photographers and their guests.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "SunboMedia",
          url: "/",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold tracking-tight">SunboMedia</span>
        <Link
          to="/auth"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Photographer sign in
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-8 pb-16 lg:grid-cols-2 lg:gap-16 lg:pt-16">
        <div className="text-center lg:text-left">
          <p
            className="rise text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground"
            style={{ animationDelay: "60ms" }}
          >
            Event photo delivery
          </p>
          <h1
            className="rise mt-5 text-4xl leading-tight font-semibold sm:text-6xl"
            style={{ animationDelay: "140ms" }}
          >
            Every guest gets only their photos.
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0"
            style={{ animationDelay: "220ms" }}
          >
            Upload an event, tag the people in the frames, and hand each one a private QR gallery.
            They preview watermarked shots and pay to unlock full resolution — nothing before.
          </p>
          <div
            className="rise mt-10 flex flex-wrap justify-center gap-3 lg:justify-start"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:scale-105 hover:opacity-90"
            >
              Start as a photographer
            </Link>
          </div>
        </div>

        <div className="rise" style={{ animationDelay: "380ms" }}>
          <HeroSlideshow />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-6">
        <PhotoMarquee />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <dl className="grid gap-5 text-left sm:grid-cols-3">
          {[
            ["Bulk upload", "Drag in a whole card of images with live progress."],
            ["Per-person QR", "An unguessable link per guest — no logins, ever."],
            ["Paid unlock", "Originals stay private until that photo is bought."],
          ].map(([title, body], i) => (
            <div
              key={title}
              className="surface rise p-5 transition-transform duration-200 hover:-translate-y-1"
              style={{ animationDelay: `${460 + i * 90}ms` }}
            >
              <dt className="font-display text-base font-semibold">{title}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
