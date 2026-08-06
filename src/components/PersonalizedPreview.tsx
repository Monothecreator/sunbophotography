import { useEffect, useRef, useState } from "react";

/**
 * Guest-facing preview renderer.
 *
 * The signed preview is drawn into a <canvas>, downscaled to a capped long edge
 * and re-stamped with the guest's own name / reference tiled diagonally across
 * the pixels. Because the mark is composited into the bitmap (not a sibling
 * <div>), it cannot be removed by hiding an element in devtools, and there is
 * no <img src> for "Save Image As" to target.
 *
 * This is a deterrent, not a block: OS-level screenshots are outside any
 * website's control. The real protection is that full-resolution, clean files
 * are only ever signed after a server-confirmed payment.
 */

const MAX_EDGE = 800;

type Props = {
  src: string;
  alt: string;
  label: string;
  className?: string;
  guarded?: boolean;
  eager?: boolean;
};

export function PersonalizedPreview({ src, alt, label, className, guarded, eager }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = eager ? "eager" : "lazy";
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);

      // Slight softening so a screenshot is pleasant to judge but poor to print.
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.filter = "blur(0.6px)";
      ctx.drawImage(canvas, 0, 0, w, h);
      ctx.restore();

      // Tiled, personalised diagonal stamp.
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = Math.max(11, Math.round(Math.max(w, h) * 0.045));
      ctx.font = `700 ${size}px Manrope, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(1, size / 14);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const text = label.toUpperCase();
      const stepX = Math.max(size * 8, ctx.measureText(text).width * 1.5);
      const stepY = size * 3;
      const span = Math.max(w, h) * 1.2;
      for (let y = -span, row = 0; y <= span; y += stepY, row++) {
        const offset = row % 2 === 0 ? 0 : stepX / 2;
        for (let x = -span + offset; x <= span; x += stepX) {
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
      setReady(true);
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [src, label, eager]);

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        onContextMenu={block}
        onDragStart={block}
        draggable={false}
        className={`${className ?? ""} block select-none [-webkit-touch-callout:none] [-webkit-user-drag:none] ${
          guarded || !ready ? "opacity-0" : ""
        }`}
      />
      {(guarded || !ready) && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted text-center text-[11px] text-muted-foreground">
          {guarded ? "Preview paused" : "Loading preview…"}
        </div>
      )}
      {/* Transparent shield so long-press / right-click targets nothing useful. */}
      <div className="absolute inset-0" onContextMenu={block} onDragStart={block} />
    </div>
  );
}

/**
 * Fires on blur / visibility change / screenshot-ish key combos. Unreliable by
 * nature (it false-triggers on tab switches) and completely inert against
 * mobile OS screenshots — used only for a brief reminder, never as a claim of
 * protection.
 */
export function usePreviewGuard() {
  const [guarded, setGuarded] = useState(false);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const trip = () => {
      setGuarded(true);
      setNotice(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setNotice(false), 2200);
    };
    const release = () => setGuarded(false);
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      const combo =
        k === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "S", "s"].includes(k)) ||
        ((e.metaKey || e.ctrlKey) && (k === "p" || k === "P"));
      if (combo) {
        e.preventDefault();
        trip();
        window.setTimeout(release, 1500);
      }
    };
    const onVisibility = () => (document.hidden ? trip() : release());

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", trip);
    window.addEventListener("focus", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", trip);
      window.removeEventListener("focus", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { guarded, notice };
}
