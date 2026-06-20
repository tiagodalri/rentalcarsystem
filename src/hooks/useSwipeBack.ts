import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * iOS-style swipe-back: arrastar da borda esquerda da tela puxa a página
 * atual pra direita e, se passar do limiar, dispara history.back() (que
 * encadeia na transição POP/slide do useNativeFeel).
 *
 * Só ativa em ponteiros "coarse" (touch). Ignora rotas raiz das áreas
 * principais (não há pra onde voltar) e ignora gestos que começam dentro de
 * elementos com [data-no-swipe-back] (ex.: mapas Leaflet, sliders, carrosséis).
 */

const ROOT_PATHS = new Set<string>([
  "/",
  "/admin",
  "/admin/login",
  "/login",
  "/cadastro",
  "/minha-conta",
]);

export function useSwipeBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
    if (!isTouch) return;
    if (ROOT_PATHS.has(pathname)) return;
    // Sem histórico anterior nesta aba, nada pra voltar.
    if (window.history.length <= 1) return;

    const EDGE = 24;           // px da borda esquerda que ativa o gesto
    const TRIGGER = 80;        // px de arrasto pra confirmar o "back"
    const MAX_VERTICAL = 40;   // se subir/descer mais que isso, cancela

    let startX = 0;
    let startY = 0;
    let dragging = false;
    let armed = false;
    let overlay: HTMLDivElement | null = null;
    let root: HTMLElement | null = null;

    const ensureOverlay = () => {
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.setAttribute("aria-hidden", "true");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        pointerEvents: "none",
        background:
          "linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0) 18%)",
        opacity: "0",
        transition: "opacity 120ms ease-out",
        zIndex: "2147483646",
      } as CSSStyleDeclaration);
      document.body.appendChild(overlay);
      return overlay;
    };

    const cleanupVisual = (animateBack: boolean) => {
      if (root) {
        if (animateBack) {
          root.style.transition = "transform 180ms cubic-bezier(.32,.72,0,1)";
          root.style.transform = "translateX(0)";
          const r = root;
          window.setTimeout(() => {
            r.style.transition = "";
            r.style.transform = "";
            r.style.willChange = "";
          }, 200);
        } else {
          root.style.transition = "";
          root.style.transform = "";
          root.style.willChange = "";
        }
      }
      if (overlay) {
        overlay.style.opacity = "0";
      }
      root = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      // Não interferir em elementos que querem o gesto pra si.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-no-swipe-back]")) return;

      startX = t.clientX;
      startY = t.clientY;
      dragging = true;
      armed = false;
      root = document.getElementById("root") as HTMLElement | null;
      if (root) root.style.willChange = "transform";
      ensureOverlay();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!armed) {
        if (Math.abs(dy) > MAX_VERTICAL) {
          dragging = false;
          cleanupVisual(true);
          return;
        }
        if (dx > 8) armed = true;
        else return;
      }

      if (dx < 0) return;
      // Resistência leve depois de TRIGGER pra dar sensação de "puxando".
      const offset = dx <= TRIGGER ? dx : TRIGGER + (dx - TRIGGER) * 0.5;
      if (root) root.style.transform = `translateX(${offset}px)`;
      if (overlay) {
        overlay.style.opacity = String(Math.min(1, dx / TRIGGER));
      }
      // Impede o navegador de tentar scroll horizontal/refresh durante o gesto.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const passed = armed && dx >= TRIGGER;

      if (passed) {
        // Esconde o overlay e deixa o slide POP do view-transition tomar conta.
        cleanupVisual(false);
        navigate(-1);
      } else {
        cleanupVisual(true);
      }
    };

    const onTouchCancel = () => {
      if (!dragging) return;
      dragging = false;
      cleanupVisual(true);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove as EventListener);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      if (root) {
        root.style.transition = "";
        root.style.transform = "";
        root.style.willChange = "";
      }
    };
  }, [navigate, pathname]);
}
