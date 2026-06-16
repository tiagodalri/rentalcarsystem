import { useEffect } from "react";

/**
 * Idle-prefetch dos chunks admin mais usados.
 *
 * Wave 2: depois que o app está ocioso, baixa em background os chunks de
 * AdminBookings/AdminFleet/AdminCustomers/AdminLive. Quando o usuário tocar
 * num card e navegar, o chunk já está em cache → tela abre instantânea em
 * vez de esperar 500-1000ms de Suspense + download.
 *
 * Usa `requestIdleCallback` quando disponível e cai para `setTimeout` em
 * Safari (ainda não suporta rIC). Só dispara uma vez por sessão. Cancela
 * tudo se o componente desmontar.
 */
export function usePrefetchAdminRoutes(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const idle: (cb: () => void) => number =
      (window as any).requestIdleCallback?.bind(window) ??
      ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancelIdle: (id: number) => void =
      (window as any).cancelIdleCallback?.bind(window) ?? window.clearTimeout;

    const id = idle(() => {
      if (cancelled) return;
      // Imports dinâmicos disparam o download do chunk e o vite/react fica
      // com o módulo em cache. Erros são silenciosos (sem rede = tudo bem).
      void import("@/pages/admin/AdminBookings.tsx").catch(() => {});
      void import("@/pages/admin/AdminFleet.tsx").catch(() => {});
      void import("@/pages/admin/AdminCustomers.tsx").catch(() => {});
      void import("@/pages/admin/AdminLive.tsx").catch(() => {});
      void import("@/pages/admin/AdminBookingDetail.tsx").catch(() => {});
    });

    return () => {
      cancelled = true;
      try { cancelIdle(id); } catch (_) {}
    };
  }, [enabled]);
}
