import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Thin sticky banner that appears when the device goes offline,
 * and briefly confirms "Conexão restabelecida" when it comes back.
 * Respects safe-area on iOS.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (wasOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 2400);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  if (online && !showReconnected) return null;

  const offline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[100] flex justify-center pointer-events-none"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
      }}
    >
      <div
        className={[
          "pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full",
          "text-xs font-medium shadow-lg backdrop-blur-md border",
          "transition-all duration-300 ease-out animate-fade-in",
          offline
            ? "bg-foreground/90 text-background border-foreground/20"
            : "bg-emerald-600/90 text-white border-emerald-400/30",
        ].join(" ")}
      >
        {offline ? (
          <>
            <WifiOff size={14} strokeWidth={2.2} />
            <span>Você está offline. Exibindo dados em cache</span>
          </>
        ) : (
          <>
            <Wifi size={14} strokeWidth={2.2} />
            <span>Conexão restabelecida</span>
          </>
        )}
      </div>
    </div>
  );
}
