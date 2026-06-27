import { useAdminFab } from "@/hooks/useAdminFab";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

/**
 * MobileFabDock — ação primária da tela ancorada na zona do polegar.
 *
 * Lê o FAB registrado via `useRegisterFab` (mesmo contrato usado pelo
 * AdminMobileHeader). Aparece flutuando no canto inferior direito, logo
 * acima do AdminBottomNav, respeitando safe-area. Não some no scroll —
 * o objetivo é ser sempre alcançável com o polegar (padrão Material /
 * Gmail). No desktop não renderiza (`lg:hidden`).
 */
export function MobileFabDock() {
  const { fab } = useAdminFab();
  if (!fab) return null;
  const Icon = fab.icon;

  return (
    <div
      className={cn(
        "lg:hidden fixed right-4 z-40 pointer-events-none",
        "transition-transform duration-200"
      )}
      style={{
        // 64px do bottom-nav + safe-area + folga visual
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <button
        type="button"
        aria-label={fab.label}
        onClick={() => {
          haptic.tap();
          fab.onClick();
        }}
        className={cn(
          "pointer-events-auto group relative inline-flex items-center gap-2",
          "h-14 pl-4 pr-5 rounded-full",
          "bg-foreground text-background",
          "active:scale-[0.96] transition-transform",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        style={{
          boxShadow:
            "0 10px 28px -8px hsl(var(--foreground) / 0.45), 0 2px 6px -2px hsl(var(--foreground) / 0.25)",
        }}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
        <span className="text-[13.5px] font-medium tracking-tight whitespace-nowrap">
          {fab.label}
        </span>
      </button>
    </div>
  );
}
