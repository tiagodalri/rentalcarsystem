import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SwipeAction — swipe-to-reveal action handles on a list row.
 *
 * Drag horizontally to expose actions on either side.
 * - `leftActions`  — revealed when user swipes RIGHT (most common: archive / dismiss).
 * - `rightActions` — revealed when user swipes LEFT (most common: call / WhatsApp).
 *
 * Releasing past ~50% of the actions width triggers the FIRST action and
 * resets to closed. Releasing before snaps back. Tapping anywhere while open
 * also closes.
 *
 * Built on framer-motion's drag so we get inertia / rubber-band for free.
 */

export interface SwipeActionItem {
  icon: import("lucide-react").LucideIcon;
  label: string;
  /** Background of the action panel when this item is the "first" on its side. */
  color: "emerald" | "rose" | "blue" | "amber" | "neutral";
  onTrigger: () => void;
}

export interface SwipeActionProps {
  children: React.ReactNode;
  leftActions?: SwipeActionItem[];
  rightActions?: SwipeActionItem[];
  className?: string;
  /** Width per action button in px. Default 78 (good for one-icon + label). */
  actionWidth?: number;
}

const COLOR_BG: Record<SwipeActionItem["color"], string> = {
  emerald: "bg-emerald-600 text-white",
  rose: "bg-rose-600 text-white",
  blue: "bg-blue-600 text-white",
  amber: "bg-amber-500 text-white",
  neutral: "bg-muted text-foreground",
};

export function SwipeAction({
  children,
  leftActions = [],
  rightActions = [],
  className,
  actionWidth = 78,
}: SwipeActionProps) {
  const x = useMotionValue(0);

  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;

  // Opacity of action panels follows drag position so they fade in as user pulls.
  const leftOpacity = useTransform(x, [0, leftWidth * 0.5, leftWidth], [0, 0.6, 1]);
  const rightOpacity = useTransform(x, [-rightWidth, -rightWidth * 0.5, 0], [1, 0.6, 0]);

  const close = React.useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  }, [x]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;

    // Threshold: 50% of side or strong flick.
    if (dx > leftWidth * 0.5 || vx > 800) {
      leftActions[0]?.onTrigger();
      close();
      return;
    }
    if (dx < -rightWidth * 0.5 || vx < -800) {
      rightActions[0]?.onTrigger();
      close();
      return;
    }
    close();
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Left action panel (swipe right to reveal) */}
      {leftActions.length > 0 && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0 flex items-stretch"
          style={{ width: leftWidth, opacity: leftOpacity }}
        >
          {leftActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onTrigger();
                close();
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
                COLOR_BG[a.color],
              )}
              style={{ width: actionWidth }}
            >
              <a.icon size={18} />
              <span className="leading-none">{a.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Right action panel (swipe left to reveal) */}
      {rightActions.length > 0 && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: rightWidth, opacity: rightOpacity }}
        >
          {rightActions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onTrigger();
                close();
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
                COLOR_BG[a.color],
              )}
              style={{ width: actionWidth }}
            >
              <a.icon size={18} />
              <span className="leading-none">{a.label}</span>
            </button>
          ))}
        </motion.div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: "pan-y" }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}
