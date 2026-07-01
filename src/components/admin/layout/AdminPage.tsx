import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminPageProps {
  children: ReactNode;
  className?: string;
}

/**
 * Global admin page shell.
 * - Consistent horizontal padding on every breakpoint
 * - Vertical rhythm (gap) between sections
 * - Full-width, no horizontal overflow
 *
 * Use for EVERY admin page to guarantee identical spacing/alignment.
 */
export function AdminPage({ children, className }: AdminPageProps) {
  return <div className={cn("admin-page", className)}>{children}</div>;
}

interface AdminSectionProps {
  children: ReactNode;
  className?: string;
}

export function AdminSection({ children, className }: AdminSectionProps) {
  return <section className={cn("admin-section", className)}>{children}</section>;
}

interface AdminKpiGridProps {
  children: ReactNode;
  /** Column preset. Default: responsive 2 → 3 → 4. */
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/**
 * KPI grid that guarantees equal card heights and consistent gap.
 * Children stretch to fill each row via `grid-auto-rows: 1fr`.
 * Never customize the grid manually — always use this wrapper.
 */
export function AdminKpiGrid({ children, cols = 4, className }: AdminKpiGridProps) {
  const colClass =
    cols === 2 ? "cols-2" :
    cols === 3 ? "cols-3" :
    cols === 5 ? "cols-5" :
    cols === 6 ? "cols-6" :
    "";
  return <div className={cn("admin-kpi-grid", colClass, className)}>{children}</div>;
}
