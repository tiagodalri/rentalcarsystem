import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { isRecoverableChunkLoadError, recoverFromStaleApp } from "@/lib/pwaRecovery";

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
function tryRecoverFromChunkError(message: string | undefined | null) {
  if (!isRecoverableChunkLoadError(message)) return false;
  void recoverFromStaleApp();
  return true;
}

window.addEventListener("error", (event) => {
  const target = event.target as HTMLElement | null;
  const source = "src" in (target || {}) ? String((target as HTMLScriptElement).src || "") : "";
  if (tryRecoverFromChunkError(event?.message || event?.error?.message || source)) {
    event.preventDefault();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason: unknown = event?.reason;
  const msg = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : null;
  if (tryRecoverFromChunkError(msg)) {
    event.preventDefault();
  }
});

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromStaleApp();
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
