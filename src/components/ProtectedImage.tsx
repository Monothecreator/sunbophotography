import { useEffect, useState } from "react";

/**
 * Deterrent-only protection for unpaid watermarked previews.
 * Browsers expose no API to block OS screenshots, so we do what is possible:
 * block right-click/save, drag-to-desktop, long-press menus, selection, and
 * hide previews while the tab is unfocused or a screenshot key is pressed.
 */
export function useScreenshotGuard() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      const combo =
        k === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "S", "s"].includes(k)) ||
        (e.metaKey && k === "p") ||
        (e.ctrlKey && k === "p");
      if (combo) {
        e.preventDefault();
        hide();
        window.setTimeout(show, 1500);
      }
    };
    const onVisibility = () => (document.hidden ? hide() : show());

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return hidden;
}

type Props = {
  src: string;
  alt: string;
  className?: string;
  guarded: boolean;
  loading?: "lazy" | "eager";
};

export function ProtectedImage({ src, alt, className, guarded, loading = "lazy" }: Props) {
  const block = (e: React.SyntheticEvent) => e.preventDefault();
  return (
    <div className="relative select-none">
      <img
        src={src}
        alt={alt}
        loading={loading}
        draggable={false}
        onContextMenu={block}
        onDragStart={block}
        className={`${className ?? ""} pointer-events-none select-none [-webkit-touch-callout:none] ${
          guarded ? "opacity-0" : ""
        }`}
      />
      {guarded && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted text-center text-[11px] text-muted-foreground">
          Preview hidden
        </div>
      )}
      {/* Transparent shield so "save image" targets nothing useful. */}
      <div className="absolute inset-0" onContextMenu={block} />
    </div>
  );
}
