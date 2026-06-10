import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type FabConfig = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
};

type Ctx = {
  fab: FabConfig | null;
  setFab: (cfg: FabConfig | null) => void;
};

const AdminFabContext = createContext<Ctx | null>(null);

export function AdminFabProvider({ children }: { children: ReactNode }) {
  const [fab, setFab] = useState<FabConfig | null>(null);
  const value = useMemo(() => ({ fab, setFab }), [fab]);
  return <AdminFabContext.Provider value={value}>{children}</AdminFabContext.Provider>;
}

export function useAdminFab() {
  const ctx = useContext(AdminFabContext);
  if (!ctx) throw new Error("useAdminFab must be used inside AdminFabProvider");
  return ctx;
}

/** Page-level hook: registers a FAB on mount, clears on unmount. */
export function useRegisterFab(cfg: FabConfig | null, deps: unknown[] = []) {
  const { setFab } = useAdminFab();
  // memoize handler ref so re-renders don't churn
  const onClick = cfg?.onClick;
  const label = cfg?.label;
  const Icon = cfg?.icon;
  const stableClick = useCallback(() => onClick?.(), [onClick]);
  useEffect(() => {
    if (!cfg || !Icon || !label) {
      setFab(null);
      return;
    }
    setFab({ icon: Icon, label, onClick: stableClick });
    return () => setFab(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Icon, label, stableClick, ...deps]);
}
