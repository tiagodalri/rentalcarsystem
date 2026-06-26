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
 *  - Se a mensagem casa com erro de chunk, não recarregamos automaticamente.
 *    O usuário pode estar preenchendo um formulário; reload surpresa causa
 *    perda de contexto no PWA.
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
  return isChunkLoadError(message);
}

window.addEventListener("error", (event) => {
  tryRecoverFromChunkError(event?.message || event?.error?.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason: any = event?.reason;
  const msg = typeof reason === "string" ? reason : reason?.message;
  tryRecoverFromChunkError(msg);
});

createRoot(document.getElementById("root")!).render(<App />);
