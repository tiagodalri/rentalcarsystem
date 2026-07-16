import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Wave 4: theme-color dinâmico — muda a barra de status do Android/PWA e a
 * top bar do safari quando o usuário entra em zonas de "tema" diferentes.
 *  - Admin (/admin/*): preto sólido (chrome admin é preto/dourado).
 *  - Cliente: respeita prefers-color-scheme (off-white claro, preto escuro).
 *
 * Sem isso, a status bar fica sempre preta (definido no index.html) e
 * "vaza" sobre o conteúdo claro do site público, parecendo bug visual.
 */
export function useDynamicThemeColor() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const isAdmin = pathname.startsWith("/admin");
    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;

    const target = isAdmin ? "#0a0a0a" : prefersDark ? "#0a0a0a" : "#F7F5F0";

    // Remove os 2 meta theme-color estáticos do index.html (com media queries)
    // e usa um único dinâmico — assim o navegador respeita exatamente o que
    // queremos por rota.
    const existing = document.querySelectorAll('meta[name="theme-color"]');
    existing.forEach((el) => el.parentElement?.removeChild(el));

    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", target);
    document.head.appendChild(meta);

    return () => {
      meta.parentElement?.removeChild(meta);
    };
  }, [pathname]);
}
