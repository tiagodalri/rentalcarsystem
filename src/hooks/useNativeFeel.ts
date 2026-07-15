import { useEffect } from "react";

/**
 * Camada "sente como nativo" — focado em UX do teclado virtual.
 *
 * As transições entre rotas via View Transitions API foram REMOVIDAS:
 * o callback de startViewTransition captura o snapshot da página antiga,
 * mas o React Router atualiza fora dele — durante a animação o navegador
 * pintava o background (preto no dark) por alguns frames, causando o
 * "flash preto" relatado ao navegar/voltar no PWA. Vamos preferir troca
 * instantânea e estável a transição vistosa porém bugada.
 */
export function useNativeFeel() {
  // 1) Marca <body> com .pwa-standalone quando o app roda como PWA instalado.
  //    Permite esconder banners de "site" (InstallPrompt, WhatsApp bubble, etc.)
  //    e aplicar chrome mais próximo de nativo via CSS.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const md = window.matchMedia?.("(display-mode: standalone)").matches === true;
      // @ts-expect-error iOS Safari
      const ios = window.navigator?.standalone === true;
      const std = md || ios;
      document.body.classList.toggle("pwa-standalone", std);
    };
    read();
    const mql = window.matchMedia?.("(display-mode: standalone)");
    mql?.addEventListener?.("change", read);
    return () => mql?.removeEventListener?.("change", read);
  }, []);



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
