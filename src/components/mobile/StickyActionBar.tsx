import * as React from "react";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

/**
 * StickyActionBar — fixed bottom action bar used for the primary action of a
 * screen (e.g. "Confirmar reserva", "Salvar inspeção").
 *
 * - Sits ABOVE the AdminBottomNav (which is 64px + safe-area).
 * - Respects safe-area on its own bottom padding so it never collides with
 *   the iOS home indicator.
 * - When the virtual keyboard opens, lifts itself ABOVE the keyboard via the
 *   visualViewport API (matches native iOS/Android forms). The bottom-nav
 *   offset is dropped while the keyboard is up (the nav itself is hidden).
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
  const kb = useKeyboardInset();
  const keyboardOpen = kb > 0;
  // When the keyboard is open, the bottom nav is covered anyway — sit flush
  // on top of the keyboard. Otherwise, sit above the bottom nav.
  const bottom = keyboardOpen ? kb : offsetBottom;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-xl",
        "px-4 pt-3 transition-[bottom] duration-200 ease-out",
        className,
      )}
      style={{
        bottom,
        paddingBottom: keyboardOpen
          ? "12px"
          : "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
    >
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}

