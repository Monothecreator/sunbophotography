import { useEffect, useState } from "react";

import img1 from "@/assets/home-1.jpg";
import img2 from "@/assets/home-2.jpg";
import img3 from "@/assets/home-3.jpg";
import img4 from "@/assets/home-4.jpg";

const SLIDES = [
  { src: img1, alt: "Newlyweds laughing together in golden hour light" },
  { src: img2, alt: "Guests holding sparklers on an evening dance floor" },
  { src: img3, alt: "Portrait of a smiling guest at an outdoor reception" },
  { src: img4, alt: "Event photographer shooting during a warmly lit reception" },
];

export function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setAnimate(false);
      return;
    }
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="surface relative aspect-[4/5] w-full overflow-hidden shadow-[0_30px_80px_-40px_oklch(0.3_0.05_45/0.55)]">
      {SLIDES.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={1200}
          height={1500}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-out ${
            i === index ? "opacity-100" : "opacity-0"
          } ${animate && i === index ? "animate-ken-burns" : ""}`}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-background" : "w-1.5 bg-background/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
