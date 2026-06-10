import { useAdminFab } from "@/hooks/useAdminFab";

/** Mobile-only floating action button. Reads the page's registered action. */
export function AdminFab() {
  const { fab } = useAdminFab();
  if (!fab) return null;
  const Icon = fab.icon;
  return (
    <button
      type="button"
      onClick={fab.onClick}
      aria-label={fab.label}
      className="lg:hidden fixed right-4 z-40 h-14 w-14 rounded-full bg-foreground text-background shadow-lg shadow-foreground/20 flex items-center justify-center active:scale-95 transition-transform"
      style={{
        bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <Icon className="h-6 w-6" strokeWidth={2.25} />
      <span className="sr-only">{fab.label}</span>
    </button>
  );
}
