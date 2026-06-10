import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Estratégia de atualização do PWA:
 *
 * - Em background, o navegador baixa a nova versão do Service Worker e ela fica
 *   no estado "waiting" (não interfere em nada que o usuário esteja fazendo).
 * - QUANDO o usuário navega para outra rota (clica num link/menu), verificamos
 *   se existe um SW esperando. Se existir, mandamos ele assumir o controle e
 *   recarregamos a página de destino — assim a nova rota já abre com o código
 *   novo, aproveitando a transição natural entre telas.
 * - Se o usuário ficar parado preenchendo um formulário, NADA acontece.
 *   Nenhum reload no meio da tarefa.
 */
export function useSwUpdateOnNavigate() {
  const { pathname, search, hash } = useLocation();
  const hasWaitingRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  const reloadingRef = useRef(false);

  // 1) Monitora a chegada de novas versões do SW.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) hasWaitingRef.current = true;
    };

    const attachUpdateListeners = (reg: ServiceWorkerRegistration) => {
      checkWaiting(reg);
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

    // Quando o novo SW assume controle, recarrega para puxar assets novos.
    const onControllerChange = () => {
      if (reloadingRef.current) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // 2) A cada mudança de rota, se houver SW esperando, ativa e recarrega.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!hasWaitingRef.current) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg?.waiting) return;
      reloadingRef.current = true;
      reg.waiting.postMessage("SKIP_WAITING");
      // O reload acontece no listener de 'controllerchange' acima.
    });
  }, [pathname, search, hash]);
}
