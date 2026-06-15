import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Estratégia de atualização do PWA (versão NÃO-INTRUSIVA):
 *
 * - Em background, o navegador baixa a nova versão do Service Worker e ela
 *   fica em estado "waiting". Nada acontece imediatamente.
 * - Quando o usuário NAVEGA para outra rota, mandamos o SW assumir o controle
 *   silenciosamente (SKIP_WAITING). A próxima requisição já usa o novo SW.
 * - NUNCA forçamos window.location.reload(). Isso era a causa do "recarregamento
 *   automático do nada" que interrompia formulários e cliques.
 * - O usuário recebe o código novo na próxima vez que abrir o app ou der refresh
 *   manual — comportamento previsível, sem surpresas.
 */
export function useSwUpdateOnNavigate() {
  const { pathname } = useLocation();
  const hasWaitingRef = useRef(false);
  const isFirstRenderRef = useRef(true);

  // Monitora chegada de novas versões — só marca a flag, NÃO recarrega.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;

    const attachUpdateListeners = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) hasWaitingRef.current = true;
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            hasWaitingRef.current = true;
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;
      attachUpdateListeners(reg);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // A cada mudança de rota, se houver SW esperando, ativa silenciosamente.
  // SEM reload. O novo SW só interceptará requisições daqui pra frente.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!hasWaitingRef.current) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg?.waiting) return;
      reg.waiting.postMessage("SKIP_WAITING");
      hasWaitingRef.current = false;
      // Intencionalmente: SEM reload. SEM controllerchange listener.
      // O usuário receberá assets novos no próximo cold start.
    });
  }, [pathname]);
}
