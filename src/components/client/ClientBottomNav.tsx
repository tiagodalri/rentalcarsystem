import { NavLink, useLocation } from "react-router-dom";
import { Home, Car, CalendarRange, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";

/**
 * ClientBottomNav — tab bar mobile-only para a área do cliente.
 * Aparece apenas em viewport < lg. No desktop, escondida.
 * Respeita safe-area do home indicator (iOS).
 */
type Tab = { label: string; url: string; icon: typeof Home; match?: (p: string) => boolean };

const TABS: Tab[] = [
  { label: "Início", url: "/", icon: Home, match: (p) => p === "/" },
  { label: "Frota", url: "/frota", icon: Car, match: (p) => p.startsWith("/frota") || p.startsWith("/veiculo") },
  {
    label: "Reservas",
    url: "/minha-conta",
    icon: CalendarRange,
    match: (p) => p.startsWith("/minha-conta") && !p.includes("tab=perfil"),
  },
  {
    label: "Perfil",
    url: "/minha-conta?tab=perfil",
    icon: User,
    match: (p) => p.startsWith("/minha-conta") && p.includes("tab=perfil"),
  },
];

const PILL_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export default function ClientBottomNav() {
  const location = useLocation();
  const pathAndSearch = location.pathname + location.search;

  const activeIndex = TABS.findIndex((t) =>
    t.match ? t.match(pathAndSearch) : pathAndSearch === t.url,
  );
  const hasActive = activeIndex >= 0;
  const count = TABS.length;

  return (
    <nav
      aria-label="Navegação"
      className="app-chrome lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/98 border-t border-border/40"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow:
          "inset 0 1px 0 hsl(var(--border) / 0.6), 0 -8px 24px -16px hsl(var(--foreground) / 0.08)",
      }}
    >
      <div className="relative h-16">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 bottom-0 flex items-center",
            hasActive ? "opacity-100" : "opacity-0",
          )}
          style={{
            left: 0,
            width: `${100 / count}%`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            transition: `transform 360ms ${PILL_EASE}, opacity 200ms ease-out`,
          }}
        >
          <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-11 rounded-2xl bg-foreground/[0.06]" />
        </span>

        <ul
          className="relative h-full grid"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = i === activeIndex;
            return (
              <li key={tab.label}>
                <NavLink
                  to={tab.url}
                  onClick={() => haptic.tick()}
                  className={cn(
                    "relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-tight transition-colors active:scale-[0.96]",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={tab.label}
                >
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-transform duration-300",
                      isActive ? "scale-110" : "scale-100",
                    )}
                    strokeWidth={isActive ? 2 : 1.7}
                  />
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
