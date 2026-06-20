import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton padrão para estados de carregamento de listas/tabelas.
 * Evita CLS (layout shift) reservando altura próxima do conteúdo real
 * e dá feedback visual consistente (pulse) em todo o app.
 */
interface LoadingRowsProps {
  count?: number;
  rowHeight?: number; // px
  className?: string;
  /** Mostra também um cabeçalho de tabela (barra mais larga em cima) */
  withHeader?: boolean;
}

export function LoadingRows({
  count = 6,
  rowHeight = 56,
  className,
  withHeader = false,
}: LoadingRowsProps) {
  return (
    <div
      className={cn("space-y-2 p-3", className)}
      role="status"
      aria-busy="true"
      aria-label="Carregando"
    >
      {withHeader && <Skeleton className="h-6 w-1/3 mb-3" />}
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          style={{ height: rowHeight }}
          className="w-full opacity-80"
        />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Versão inline (linhas únicas pequenas, ex.: dentro de cards/tags). */
export function LoadingInline({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-busy="true"
    >
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-3 w-24" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
