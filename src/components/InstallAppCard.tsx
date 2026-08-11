import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sunbo-install-dismissed";

/**
 * Shown only when the browser actually offers installation (Chrome/Android,
 * desktop Chromium) or on iOS Safari where installing is a manual Share-sheet
 * step. Dismissal is remembered so it never nags.
 */
export function InstallAppCard() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (alreadyInstalled) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    setDismissed(false);

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Android/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed || (!promptEvent && !iosHint)) return null;

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-display text-sm font-semibold">Install SunboMedia</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {iosHint && !promptEvent
            ? "Tap Share, then “Add to Home Screen” to run SunboMedia like an app."
            : "Add it to your home screen for a full-screen, app-like studio."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {promptEvent && (
          <button
            type="button"
            onClick={async () => {
              await promptEvent.prompt();
              await promptEvent.userChoice;
              setPromptEvent(null);
              close();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Install app
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
