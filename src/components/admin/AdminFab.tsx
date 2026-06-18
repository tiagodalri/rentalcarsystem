import { useAdminFab } from "@/hooks/useAdminFab";
import { haptic } from "@/lib/haptic";

/** Mobile-only floating action button. Reads the page's registered action. */
export function AdminFab() {
  const { fab } = useAdminFab();
  if (!fab) return null;
  const Icon = fab.icon;
  return (
    <button
      type="button"
      onClick={(e) => { haptic.tap(); fab.onClick(e as any); }}
      aria-label={fab.label}
      className="lg:hidden fixed right-4 z-40 h-14 w-14 rounded-full bg-foreground text-background flex items-center justify-center active:scale-95 transition-all duration-150 ring-1 ring-foreground/10"
      style={{
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
        boxShadow: "10px 10px 24px -8px hsl(var(--foreground) / 0.28), 4px 3px 6px -2px hsl(var(--foreground) / 0.18)",
      }}
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
      <span className="sr-only">{fab.label}</span>
    </button>
  );
}
