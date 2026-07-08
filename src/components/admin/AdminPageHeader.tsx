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
 * Editorial admin page header — Private Bank + serif display.
 */
export function AdminPageHeader({ title, subtitle, actions, eyebrow, className }: Props) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 pb-5 lg:pb-8 mb-1",
        "border-b border-border/40",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="admin-eyebrow-line mb-2">{eyebrow}</div>
        )}
        <h1 className="admin-h1 truncate">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-[13px] text-muted-foreground lg:text-[14px] font-light leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      )}
    </header>
  );
}
