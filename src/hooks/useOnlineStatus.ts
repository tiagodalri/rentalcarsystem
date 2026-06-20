import { useEffect, useState } from "react";

/**
 * Tracks browser online/offline state with a small debounce on going back online,
 * to avoid flicker when a flaky network bounces.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    let onlineTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (onlineTimer) {
        clearTimeout(onlineTimer);
        onlineTimer = null;
      }
      setOnline(false);
    };

    const handleOnline = () => {
      // Debounce: only flip to online after 600ms of sustained connectivity.
      if (onlineTimer) clearTimeout(onlineTimer);
      onlineTimer = setTimeout(() => setOnline(true), 600);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (onlineTimer) clearTimeout(onlineTimer);
    };
  }, []);

  return online;
}
