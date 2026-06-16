import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * ChunkLoadError recovery — corrige o sintoma de "tela branca, precisa fechar
 * e abrir o app de novo" que aparece quando o SW (ou o navegador) serve um
 * index.html velho que aponta para chunks JS que já não existem no servidor
 * após um deploy novo.
 *
 * Estratégia:
 *  - Escutamos erros globais (window.error) e promessas rejeitadas.
 *  - Se a mensagem casa com "ChunkLoadError" / "Loading chunk" / "Failed to
 *    fetch dynamically imported module", recarregamos a página UMA VEZ.
 *  - Guarda anti-loop em sessionStorage: se já tentamos recarregar nessa
 *    sessão, paramos para não entrar em loop infinito de reload.
 */
function isChunkLoadError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("chunkloaderror") ||
    m.includes("loading chunk") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module")
  );
}

function tryRecoverFromChunkError(message: string | undefined | null) {
  if (!isChunkLoadError(message)) return false;
  try {
    const KEY = "zeus:chunk-reload-attempted";
    if (sessionStorage.getItem(KEY)) {
      // Já tentamos uma vez nessa sessão; não recarregar de novo.
      // Melhor mostrar a tela branca do que entrar em loop.
      return false;
    }
    sessionStorage.setItem(KEY, String(Date.now()));
    // Pequeno delay para permitir log/telemetria antes do reload.
    setTimeout(() => window.location.reload(), 50);
    return true;
  } catch (_) {
    setTimeout(() => window.location.reload(), 50);
    return true;
  }
}

window.addEventListener("error", (event) => {
  tryRecoverFromChunkError(event?.message || event?.error?.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event?.reason;
  const msg = typeof reason === "string" ? reason : reason?.message;
  tryRecoverFromChunkError(msg);
});

// Limpa o flag de reload no próximo carregamento bem-sucedido, para que um
// futuro deploy ainda possa acionar a recuperação automática.
window.addEventListener("load", () => {
  try {
    setTimeout(() => sessionStorage.removeItem("zeus:chunk-reload-attempted"), 5000);
  } catch (_) {}
});

createRoot(document.getElementById("root")!).render(<App />);
