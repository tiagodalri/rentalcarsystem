import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Optional color class applied to the value (e.g. text-emerald-600). */
  valueClassName?: string;
  className?: string;
  /** Slightly reduced padding, use inside dense grids. */
  compact?: boolean;
}

/**
 * Standard KPI card used across the admin panel.
 *
 * Rules (do NOT override):
 * - Fixed min-height so every card in a grid aligns perfectly on every breakpoint.
 * - Vertically centered via flex; content NEVER slides up when hint is empty.
 * - Consistent typography: uppercase label, `admin-kpi` value, muted hint.
 * - Uses `&nbsp;` placeholder when `hint` is missing to preserve the 3-line rhythm.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  valueClassName,
  className,
  compact = false,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "border-border/40 h-full transition-all duration-200 ease-out",
        "hover:border-border hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_hsl(0_0%_0%/0.25)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center text-center",
          compact ? "min-h-[124px] gap-2 px-4 py-5" : "min-h-[144px] gap-2.5 px-5 py-6",
        )}
      >
        <div className="flex min-h-[16px] items-center justify-center gap-1.5 leading-[1.15]">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />}
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-[1.15]">
            {label}
          </p>
        </div>
        <p
          className={cn(
            "admin-kpi tabular-nums leading-[1.05]",
            compact ? "text-xl" : "text-2xl",
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className="min-h-[14px] text-[11px] text-muted-foreground leading-[1.2]">
          {hint ?? "\u00A0"}
        </p>
      </div>
    </Card>
  );
}
