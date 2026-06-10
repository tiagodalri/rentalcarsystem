import { useEffect, useState } from "react";

/**
 * Mobile-shell detection for the admin area.
 *
 * Uses the same breakpoint convention the admin chrome uses (`lg` = 1024px):
 * below that we render the mobile-first layouts; at and above, the desktop.
 *
 * Also surfaces `isStandalone` so screens can lean a little more "native"
 * when the user opened the installed PWA (no browser chrome).
 */
const MOBILE_BREAKPOINT = 1024;

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; everyone else uses display-mode.
  const iosStandalone = (window.navigator as any).standalone === true;
  const mqStandalone = window.matchMedia?.("(display-mode: standalone)").matches === true;
  return iosStandalone || mqStandalone;
}

export function useIsMobileApp() {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < MOBILE_BREAKPOINT,
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(() => readStandalone());

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    onChange();

    const stdMql = window.matchMedia("(display-mode: standalone)");
    const onStd = () => setIsStandalone(readStandalone());
    stdMql.addEventListener?.("change", onStd);

    return () => {
      mql.removeEventListener("change", onChange);
      stdMql.removeEventListener?.("change", onStd);
    };
  }, []);

  return { isMobile, isStandalone };
}
