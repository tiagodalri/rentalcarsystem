import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

const CHUNK_ERROR_REGEX =
  /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i;

/**
 * Boundary por rota. Se uma tela falhar ao carregar (chunk perdido após deploy,
 * rede caiu no meio do import etc.), mostramos um fallback amigável com botão
 * "tentar de novo" em vez de tela em branco / Suspense infinito.
 *
 * Caso seja erro clássico de chunk obsoleto, não damos reload automático:
 * isso interrompe formulários no PWA. O usuário decide quando tentar de novo.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    const isChunkError = CHUNK_ERROR_REGEX.test(error.message || "");
    if (isChunkError) {
      this.setState({ error });
      // Auto-recover ONCE por sessão: limpa caches do SW e recarrega.
      // Drafts já são salvos em visibilitychange/pagehide via useFormDraft,
      // então o reload não perde dados de formulário do usuário.
      try {
        const KEY = "__zeus_chunk_recover__";
        if (!sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, String(Date.now()));
          void (async () => {
            try {
              if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
              if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
            } catch (_) {}
            window.location.reload();
          })();
        }
      } catch (_) {}
    }
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary]", error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base font-medium text-foreground">
            Não consegui carregar esta tela.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Pode ser a conexão ou uma atualização recente do app. Tente novamente.
          </p>
          <Button onClick={this.reset} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
