import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { isRecoverableChunkLoadError, recoverFromStaleApp } from "@/lib/pwaRecovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
}
interface State {
  error: Error | null;
}

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
    const isChunkError = isRecoverableChunkLoadError(error.message || "");
    if (isChunkError) {
      this.setState({ error });
      void recoverFromStaleApp();
    }
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary]", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    const isChunkError = isRecoverableChunkLoadError(this.state.error?.message || "");
    if (isChunkError) {
      // chunk antigo: limpar caches e recarregar é a única forma confiável
      void recoverFromStaleApp({ force: true });
      return;
    }
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
