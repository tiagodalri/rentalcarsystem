import { X, Plus } from "lucide-react";
import { useAdminTabs, getTabTitle, MAX_TABS } from "@/hooks/useAdminTabs";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

export function AdminTabsBar() {
  const { tabs, activeId, activateTab, closeTab, openTab, canAddMore } = useAdminTabs();
  const location = useLocation();

  // Só renderiza a barra quando há 2+ abas (mantém UI discreta no uso normal)
  if (tabs.length < 2) return null;

  const handleNewTab = () => {
    // Abre uma nova aba apontando para o Dashboard por padrão
    openTab("/admin");
  };

  return (
    <div
      className="flex items-center gap-1 px-2 sm:px-3 h-9 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-14 z-20 overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Abas abertas"
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        const title = getTabTitle(t.path);
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => !active && activateTab(t.id)}
            onAuxClick={(e) => {
              // botão do meio fecha aba
              if (e.button === 1) {
                e.preventDefault();
                closeTab(t.id);
              }
            }}
            className={cn(
              "group flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-md text-xs cursor-pointer shrink-0 transition-colors max-w-[180px]",
              active
                ? "bg-card text-foreground border border-border/60 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
            title={t.path}
          >
            <span className="truncate font-medium">{title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
              aria-label={`Fechar aba ${title}`}
              className={cn(
                "h-5 w-5 rounded flex items-center justify-center transition-opacity",
                "hover:bg-muted text-muted-foreground hover:text-foreground",
                active ? "opacity-80" : "opacity-0 group-hover:opacity-80",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={handleNewTab}
        disabled={!canAddMore}
        title={canAddMore ? "Abrir nova aba" : `Limite de ${MAX_TABS} abas`}
        aria-label="Abrir nova aba"
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0",
          !canAddMore && "opacity-40 cursor-not-allowed",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <span className="ml-1 text-[10px] text-muted-foreground/60 tabular-nums shrink-0 hidden sm:inline">
        {tabs.length}/{MAX_TABS}
      </span>
    </div>
  );
}
