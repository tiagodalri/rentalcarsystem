import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MobileListItem — single row used in mobile lists (clientes, reservas, frota).
 * Apple-style: 56pt+ tall, left avatar/icon slot, title + subtitle, optional
 * right slot (value/badge), optional chevron.
 *
 * The whole row is the tap target.
 */
export interface MobileListItemProps {
  /** Left visual: avatar, icon, brand mark, or color dot. */
  leading?: React.ReactNode;
  /** Primary line. */
  title: React.ReactNode;
  /** Secondary line directly under the title. */
  subtitle?: React.ReactNode;
  /** Optional tiny line of metadata above the title (e.g. "11:00 · Check-in"). */
  meta?: React.ReactNode;
  /** Right slot: value, badge, chevron container. */
  trailing?: React.ReactNode;
  /** Show a chevron at the far right (defaults to true when onClick is set). */
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  /** Visual emphasis. `danger` shows a red accent stripe at the left edge. */
  accent?: "danger" | "success" | "warning";
  /** Disable the active-press affordance for non-interactive rows. */
  inert?: boolean;
}

const ACCENT_BAR: Record<NonNullable<MobileListItemProps["accent"]>, string> = {
  danger: "bg-rose-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
};

export function MobileListItem({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  onClick,
  className,
  accent,
  inert,
}: MobileListItemProps) {
  const interactive = !!onClick && !inert;
  const showChevron = chevron ?? interactive;

  const inner = (
    <>
      {accent && (
        <span
          className={cn(
            "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full",
            ACCENT_BAR[accent],
          )}
        />
      )}
      {leading && (
        <div className="shrink-0 self-center">{leading}</div>
      )}
      <div className="flex-1 min-w-0 self-center">
        {meta && (
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-muted-foreground leading-tight mb-0.5">
            {meta}
          </div>
        )}
        <div className="text-[15px] font-medium text-foreground leading-tight truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12.5px] text-muted-foreground leading-tight mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && (
        <div className="shrink-0 self-center text-right">{trailing}</div>
      )}
      {showChevron && (
        <ChevronRight
          size={18}
          className="shrink-0 self-center text-muted-foreground/50"
          strokeWidth={1.75}
        />
      )}
    </>
  );

  const baseClass = cn(
    "relative w-full flex items-stretch gap-3 px-4 py-3 min-h-[60px] text-left",
    interactive && "active:bg-muted/60 transition-colors",
    className,
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {inner}
      </button>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}

/** A grouped list container: divides items with hairlines and rounds the edges. */
export function MobileList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/60 overflow-hidden divide-y divide-border/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
