import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Barra de progresso fina no topo (estilo YouTube/GitHub).
 * - Liga em cliques de links internos.
 * - Desliga quando a rota de destino é alcançada (ou após timeout de segurança).
 *
 * Dá feedback visual instantâneo de "estou indo" e elimina a sensação de
 * "travou" enquanto chunks/queries carregam.
 */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const start = () => {
    clearTimers();
    setFading(false);
    setVisible(true);
    setProgress(8);
    timersRef.current.push(window.setTimeout(() => setProgress(45), 60));
    timersRef.current.push(window.setTimeout(() => setProgress(72), 220));
    timersRef.current.push(window.setTimeout(() => setProgress(88), 700));
    // safety auto-finish (chunk/query lentíssimo)
    timersRef.current.push(window.setTimeout(() => finish(), 5000));
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    timersRef.current.push(
      window.setTimeout(() => {
        setFading(true);
        timersRef.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setFading(false);
            setProgress(0);
          }, 220)
        );
      }, 140)
    );
  };

  // Capture cliques em links internos
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as HTMLElement | null)?.closest?.(
        "a"
      ) as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
        return;
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
        start();
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Quando a URL muda, encerra a barra (entrou na rota nova)
  useEffect(() => {
    if (visible) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearTimers(), []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[2147483647]"
      style={{ height: 2 }}
    >
      <div
        className="h-full bg-foreground"
        style={{
          width: `${progress}%`,
          opacity: fading ? 0 : 1,
          transition: fading
            ? "opacity 220ms ease-out"
            : "width 220ms cubic-bezier(.32,.72,0,1)",
          boxShadow: "0 0 8px hsl(var(--foreground) / 0.45)",
        }}
      />
    </div>
  );
}
