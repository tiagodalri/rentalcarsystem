import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/** Floating, ultra-discrete fullscreen toggle. Sits in the bottom-right corner of every admin page. */
export default function FullscreenFab() {
  const [isFs, setIsFs] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const doc: any = document;
    setSupported(!!(doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen));
    const onChange = () => setIsFs(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const doc: any = document;
    const el: any = document.documentElement;
    if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      (el.requestFullscreen?.() || el.webkitRequestFullscreen?.())?.catch?.(() => {});
    } else {
      (doc.exitFullscreen?.() || doc.webkitExitFullscreen?.())?.catch?.(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFs ? "Sair da tela cheia" : "Tela cheia"}
      title={isFs ? "Sair da tela cheia (F11)" : "Tela cheia (F11)"}
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors flex items-center justify-end"
    >
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
