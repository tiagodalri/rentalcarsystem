import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className={cn("border-border/40", className)}>
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center gap-2",
          compact ? "min-h-[112px] px-3 py-4" : "min-h-[128px] px-4 py-5",
        )}
      >
        <div className="flex items-center justify-center gap-1.5 leading-none">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />}
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">
            {label}
          </p>
        </div>
        <p
          className={cn(
            "admin-kpi tabular-nums leading-none",
            compact ? "text-xl" : "text-2xl",
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground leading-none min-h-[12px]">
          {hint ?? "\u00A0"}
        </p>
      </div>
    </Card>
  );
}
