import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Right-aligned action slot (button, button group, etc.). */
  actions?: ReactNode;
  /** Optional eyebrow line above the title (e.g. breadcrumb, status). */
  eyebrow?: ReactNode;
  className?: string;
};

/**
 * Standardized admin page header. Mobile-first density, scales up to desktop.
 * Use this on every admin page instead of hand-rolling the H1 layout.
 */
export function AdminPageHeader({ title, subtitle, actions, eyebrow, className }: Props) {
  return (
    <header className={cn("flex items-start justify-between gap-3 pb-4 lg:pb-6", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="admin-label mb-1.5">{eyebrow}</div>
        )}
        <h1 className="admin-h1 truncate">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-muted-foreground lg:text-sm">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      )}
    </header>
  );
}
