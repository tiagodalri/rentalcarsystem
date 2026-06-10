import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StickyActionBar — fixed bottom action bar used for the primary action of a
 * screen (e.g. "Confirmar reserva", "Salvar inspeção").
 *
 * - Sits ABOVE the AdminBottomNav (which is 64px + safe-area).
 * - Respects safe-area on its own bottom padding so it never collides with
 *   the iOS home indicator.
 * - Only renders its own container; you pass the button(s) as children.
 *
 * Pair with an empty `<div style={{ height: <bar-height> }} />` at the end of
 * the scrolling area so the last item doesn't disappear under the bar.
 */
export interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
  /** Distance from the bottom of the viewport in px (default sits above the bottom nav). */
  offsetBottom?: number;
}

export function StickyActionBar({
  children,
  className,
  offsetBottom = 64, // bottom nav height
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-xl",
        "px-4 pt-3",
        className,
      )}
      style={{
        bottom: offsetBottom,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
    >
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}
