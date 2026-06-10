import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, CalendarRange, Car, Users, Menu } from "lucide-react";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5 h-16">
        {visible.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.url ? pathname === tab.url || pathname.startsWith(tab.url + "/") : false;
          const baseClass = cn(
            "relative h-full w-full flex flex-col items-center justify-center gap-1 text-[10px] tabular-nums tracking-wide uppercase",
            isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground transition-colors"
          );
          const indicator = isActive ? (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-foreground" />
          ) : null;

          if (tab.action === "open-sidebar") {
            return (
              <li key={tab.label}>
                <button type="button" onClick={() => setOpenMobile(true)} className={baseClass}>
                  {indicator}
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.label}>
              <NavLink to={tab.url!} className={baseClass}>
                {indicator}
                <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
