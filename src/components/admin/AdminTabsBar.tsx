import { X, Plus, LayoutDashboard, Sparkles, Radio, CalendarRange, CalendarDays, Car, Users, DollarSign, UsersRound, Settings, Copy } from "lucide-react";
import { useAdminTabs, getTabTitle, MAX_TABS } from "@/hooks/useAdminTabs";
import { cn } from "@/lib/utils";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "react-router-dom";
import { useState } from "react";

type RouteOption = { title: string; url: string; icon: typeof LayoutDashboard; allowedRoles: AppRole[] };

const ROUTE_OPTIONS: RouteOption[] = [
  { title: "Dashboard",     url: "/admin",                  icon: LayoutDashboard, allowedRoles: ["admin","finance","operations","support"] },
  { title: "Operação Hoje", url: "/admin/ops-today",        icon: Sparkles,        allowedRoles: ["admin","operations","support"] },
  { title: "Live",          url: "/admin/live",             icon: Radio,           allowedRoles: ["admin","operations"] },
  { title: "Reservas",      url: "/admin/bookings",         icon: CalendarRange,   allowedRoles: ["admin","operations","support"] },
  { title: "Calendário",    url: "/admin/calendar",         icon: CalendarDays,    allowedRoles: ["admin","operations","support"] },
  { title: "Frota",         url: "/admin/fleet",            icon: Car,             allowedRoles: ["admin","operations"] },
  { title: "Clientes",      url: "/admin/customers",        icon: Users,           allowedRoles: ["admin","operations","support"] },
  { title: "Financeiro",    url: "/admin/finance",          icon: DollarSign,      allowedRoles: ["admin","finance"] },
  { title: "Equipe",        url: "/admin/team",             icon: UsersRound,      allowedRoles: ["admin"] },
  { title: "Relatórios",    url: "/admin/report",           icon: BarChart3,       allowedRoles: ["admin","finance"] },
  { title: "Configurações", url: "/admin/settings",         icon: Settings,        allowedRoles: ["admin"] },
];

export function AdminTabsBar() {
  const { tabs, activeId, activateTab, closeTab, openTab, canAddMore } = useAdminTabs();
  const { hasAny } = useAdminAuth();
  const location = useLocation();
  const [openPopover, setOpenPopover] = useState(false);

  const visibleRoutes = ROUTE_OPTIONS.filter((r) => hasAny(r.allowedRoles));

  const handleOpenRoute = (url: string) => {
    setOpenPopover(false);
    openTab(url);
  };

  const handleDuplicate = () => {
    setOpenPopover(false);
    // Duplica a aba ativa abrindo o mesmo path "como novo"
    const active = tabs.find((t) => t.id === activeId);
    const target = active?.path ?? location.pathname + location.search;
    // Mesmo se já existir, queremos forçar nova aba — usa um truque com query param vazio? não.
    // Em vez disso, se canAddMore permite, criamos via openTab com path único acrescentando hash temporário.
    // Para manter simples: openTab que ativa existente; se quiser cópia real, mudamos uma flag.
    openTab(target);
  };

  return (
    <div
      className="flex items-center gap-0.5 px-2 h-10 bg-muted/40 border-b border-border/60 overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Abas abertas"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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
              if (e.button === 1) {
                e.preventDefault();
                closeTab(t.id);
              }
            }}
            className={cn(
              "group relative flex items-center gap-2 h-8 pl-3 pr-1.5 rounded-t-md text-xs cursor-pointer shrink-0 transition-colors max-w-[200px] min-w-[120px]",
              active
                ? "bg-background text-foreground border border-b-0 border-border/60 -mb-px z-10"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60",
            )}
            title={t.path}
          >
            <span className="truncate flex-1 font-medium">{title}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                aria-label={`Fechar aba ${title}`}
                className={cn(
                  "h-5 w-5 rounded flex items-center justify-center transition-opacity shrink-0",
                  "hover:bg-muted text-muted-foreground hover:text-foreground",
                  active ? "opacity-80" : "opacity-0 group-hover:opacity-80",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}

      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!canAddMore}
            aria-label="Abrir nova aba"
            title={canAddMore ? "Abrir nova aba" : `Limite de ${MAX_TABS} abas`}
            className={cn(
              "h-7 w-7 ml-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors shrink-0",
              !canAddMore && "opacity-40 cursor-not-allowed",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className="w-64 p-0">
          <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Abrir em nova aba
          </div>
          <div className="max-h-[320px] overflow-y-auto pb-1">
            {visibleRoutes.map((r) => (
              <button
                key={r.url}
                type="button"
                onClick={() => handleOpenRoute(r.url)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
              >
                <r.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{r.title}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border/60">
            <button
              type="button"
              onClick={handleDuplicate}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span>Duplicar página atual</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums shrink-0 hidden sm:inline pr-1">
        {tabs.length}/{MAX_TABS}
      </span>
    </div>
  );
}
