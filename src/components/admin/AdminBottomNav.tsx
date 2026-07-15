import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, CalendarRange, Car, Users, Menu } from "lucide-react";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";


type Tab = {
  label: string;
  url?: string;
  icon: typeof Sparkles;
  allowedRoles: AppRole[];
  action?: "open-sidebar";
};

const TABS: Tab[] = [
  { label: "Hoje", url: "/admin/ops-today", icon: Sparkles, allowedRoles: ["admin", "operations", "support", "driver"] },
  { label: "Reservas", url: "/admin/bookings", icon: CalendarRange, allowedRoles: ["admin", "operations", "support", "driver"] },
  { label: "Frota", url: "/admin/fleet", icon: Car, allowedRoles: ["admin", "operations"] },
  { label: "Clientes", url: "/admin/customers", icon: Users, allowedRoles: ["admin", "operations", "support"] },
  { label: "Mais", icon: Menu, allowedRoles: ["admin", "operations", "support", "finance", "driver"], action: "open-sidebar" },
];

export function AdminBottomNav() {
  const { hasAny } = useAdminAuth();
  const { setOpenMobile } = useSidebar();
  const { pathname } = useLocation();

  const visible = TABS.filter((t) => hasAny(t.allowedRoles));
  const count = visible.length || 1;

  const activeIndex = (() => {
    const idx = visible.findIndex(
      (t) => t.url && (pathname === t.url || pathname.startsWith(t.url + "/"))
    );
    return idx;
  })();
  const hasActive = activeIndex >= 0;

  // Easing tipo iOS / Threads — spring sutil para o pill deslizar entre as abas.
  const PILL_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <nav
      aria-label="Navegação principal"
      className="app-chrome lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-xl"

      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow:
          "inset 0 1px 0 hsl(var(--border) / 0.6), 0 -8px 24px -16px hsl(var(--foreground) / 0.08)",
      }}
    >
      <div className="relative h-16">
        {/* Pill animado que desliza entre as abas (estilo Instagram/Threads).
            Wrapper tem largura EXATA de uma coluna (100%/count) e desliza
            translateX(activeIndex * 100%) — assim cada passo é exatamente
            uma coluna. Margens visuais ficam por dentro (inset). */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 bottom-0 flex items-center",
            hasActive ? "opacity-100" : "opacity-0"
          )}
          style={{
            left: 0,
            width: `${100 / count}%`,
            transform: `translateX(${activeIndex * 100}%)`,
            transition: `transform 360ms ${PILL_EASE}, opacity 200ms ease-out`,
          }}
        >
          <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-11 rounded-2xl bg-foreground/[0.06]" />
        </span>

        {/* Barra superior fina que também desliza (acento visual). */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 h-[3px]",
            hasActive ? "opacity-100" : "opacity-0"
          )}
          style={{
            left: 0,
            width: `${100 / count}%`,
            transform: `translateX(${activeIndex * 100}%)`,
            transition: `transform 360ms ${PILL_EASE}, opacity 200ms ease-out`,
          }}
        >
          <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-foreground" />
        </span>


        <ul
          className="relative h-full grid"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {visible.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = i === activeIndex;
            const baseClass = cn(
              "relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-tight transition-colors active:scale-[0.96]",
              "transition-transform duration-150",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            );
            const iconClass = cn(
              "h-[22px] w-[22px] transition-transform duration-300",
              isActive ? "scale-110" : "scale-100"
            );

            if (tab.action === "open-sidebar") {
              return (
                <li key={tab.label}>
                  <button
                    type="button"
                    onClick={() => { haptic.tick(); setOpenMobile(true); }}
                    className={baseClass}
                    aria-label={tab.label}
                  >
                    <Icon className={iconClass} strokeWidth={1.7} />
                    <span className="leading-none">{tab.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.label}>
                <NavLink
                  to={tab.url!}
                  onClick={() => haptic.tick()}
                  className={baseClass}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={iconClass} strokeWidth={isActive ? 2 : 1.7} />
                  <span className={cn("leading-none", isActive && "font-medium")}>{tab.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
