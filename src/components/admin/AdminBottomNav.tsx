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
  { label: "Hoje", url: "/admin/ops-today", icon: Sparkles, allowedRoles: ["admin", "operations", "support"] },
  { label: "Reservas", url: "/admin/bookings", icon: CalendarRange, allowedRoles: ["admin", "operations", "support"] },
  { label: "Frota", url: "/admin/fleet", icon: Car, allowedRoles: ["admin", "operations"] },
  { label: "Clientes", url: "/admin/customers", icon: Users, allowedRoles: ["admin", "operations", "support"] },
  { label: "Mais", icon: Menu, allowedRoles: ["admin", "operations", "support", "finance"], action: "open-sidebar" },
];

export function AdminBottomNav() {
  const { hasAny } = useAdminAuth();
  const { setOpenMobile } = useSidebar();
  const { pathname } = useLocation();

  const visible = TABS.filter((t) => hasAny(t.allowedRoles));

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-xl"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "inset 0 1px 0 hsl(var(--border) / 0.6), 0 -8px 24px -16px hsl(var(--foreground) / 0.08)",
      }}
    >
      <ul className="grid grid-cols-5 h-16">
        {visible.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.url ? pathname === tab.url || pathname.startsWith(tab.url + "/") : false;
          const baseClass = cn(
            "relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-tight transition-colors active:bg-muted/30",
            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          );
          const indicator = (
            <span
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-foreground transition-all duration-200",
                isActive ? "w-10 opacity-100" : "w-0 opacity-0"
              )}
            />
          );

          if (tab.action === "open-sidebar") {
            return (
              <li key={tab.label}>
                <button
                  type="button"
                  onClick={() => { haptic.tick(); setOpenMobile(true); }}
                  className={baseClass}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {indicator}
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2 : 1.6} />
                  <span className={cn("leading-none", isActive && "font-medium")}>{tab.label}</span>
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
                {indicator}
                <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2 : 1.6} />
                <span className={cn("leading-none", isActive && "font-medium")}>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
