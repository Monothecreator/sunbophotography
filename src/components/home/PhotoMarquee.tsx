import img1 from "@/assets/home-1.jpg";
import img2 from "@/assets/home-2.jpg";
import img3 from "@/assets/home-3.jpg";
import img4 from "@/assets/home-4.jpg";

const FRAMES = [
  { src: img1, alt: "Wedding couple portrait" },
  { src: img2, alt: "Sparklers on the dance floor" },
  { src: img3, alt: "Guest portrait at a reception" },
  { src: img4, alt: "Photographer at work during an event" },
];

export function PhotoMarquee() {
  const loop = [...FRAMES, ...FRAMES];

  return (
    <div className="marquee-mask relative w-full overflow-hidden py-2">
      <div className="animate-marquee flex w-max gap-4">
        {loop.map((frame, i) => (
          <img
            key={`${frame.src}-${i}`}
            src={frame.src}
            alt={frame.alt}
            width={1200}
            height={1500}
            loading="lazy"
            className="h-40 w-32 shrink-0 rounded-lg object-cover sm:h-56 sm:w-44"
          />
        ))}
      </div>
    </div>
  );
}
