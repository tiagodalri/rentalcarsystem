import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — iOS-style pill switch. Use INSTEAD of Tabs on mobile.
 *
 * - Single tap target row; the active segment is filled, the others ghost.
 * - Whole row is rounded; minimum 40pt touch height.
 * - Controlled component: pass `value` and `onChange`.
 */
export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional badge / count rendered after the label. */
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Visual size. `sm` = 36pt, `md` = 44pt (default). */
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex w-full items-stretch rounded-full bg-muted/60 p-1",
        size === "md" ? "h-11" : "h-9",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 min-w-0 inline-flex items-center justify-center gap-1 overflow-hidden rounded-full px-2 text-[13px] font-medium transition-all duration-150 active:scale-[0.98]",
              active
                ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_10px_-4px_rgba(0,0,0,0.18)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="min-w-0 truncate">{opt.label}</span>
            {opt.badge != null && (
              <span
                className={cn(
                  "shrink-0 min-w-[18px] px-1.5 py-px rounded-full text-[10.5px] tabular-nums leading-tight",
                  active
                    ? "bg-foreground/10 text-foreground"
                    : "bg-foreground/8 text-muted-foreground",
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>

        );
      })}
    </div>
  );
}
