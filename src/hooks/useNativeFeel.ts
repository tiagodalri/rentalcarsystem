import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Camada "sente como nativo" — duas melhorias globais:
 *
 *  1) Transições suaves entre rotas via View Transitions API (Chrome/Edge/Safari 18+).
 *     Fallback silencioso onde não há suporte: troca instantânea, sem flash.
 *     Honra prefers-reduced-motion via CSS (não anima quando o usuário pediu).
 *
 *  2) Auto-scroll do input focado para o centro da viewport quando o teclado
 *     virtual abre no mobile. Combinado com `interactive-widget=resizes-content`
 *     no viewport, elimina o bug clássico de "o teclado tampa o campo".
 */
export function useNativeFeel() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prevPath = useRef(pathname);

  // 1) View Transitions: slide direcional quando a rota muda.
  //    PUSH => entra pela direita (forward). POP => entra pela esquerda (back),
  //    imitando o push/pop nativo de iOS/Android.
  useLayoutEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const doc: any = document;
    const root = document.documentElement;
    const direction = navType === "POP" ? "back" : "forward";
    root.dataset.navDirection = direction;

    if (typeof doc.startViewTransition !== "function") return;
    try {
      const transition = doc.startViewTransition(() => {});
      const cleanup = () => {
        if (root.dataset.navDirection === direction) {
          delete root.dataset.navDirection;
        }
      };
      transition?.finished?.then?.(cleanup, cleanup);
    } catch { /* no-op */ }
  }, [pathname, navType]);

  // 2) Centralizar input focado quando teclado virtual abre.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
    if (!isTouch) return;

    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      const editable = (el as HTMLElement).isContentEditable;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !editable) return;
      // Pequeno delay deixa o teclado começar a abrir e o layout a recalcular.
      window.setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          el.scrollIntoView();
        }
      }, 220);
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
}
