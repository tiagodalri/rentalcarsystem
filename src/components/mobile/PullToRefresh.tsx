import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PullToRefresh — wrap any scrollable list with this and a downward pull
 * from the top will trigger an async refresh callback.
 *
 * Works on touch devices (uses pointer events). Falls back to no-op on
 * desktop / non-touch — the wrapped content is unchanged.
 *
 * Visual:
 *  - As the user pulls, a small chip with a spinning arrow grows in.
 *  - Past ~70px, the chip "snaps" full opacity meaning release-to-refresh.
 *  - On release, fires onRefresh() and shows a spinner until it resolves.
 */
export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  className?: string;
  /** Max pull distance in px (rubber-band caps here). Default 110. */
  maxPull?: number;
  /** Trigger threshold in px. Default 70. */
  threshold?: number;
  /** Disable entirely (e.g. when a sheet is open). */
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  maxPull = 110,
  threshold = 70,
  disabled,
}: PullToRefreshProps) {
  const y = useMotionValue(0);
  const indicatorY = useTransform(y, (v) => Math.min(v, maxPull));
  const indicatorOpacity = useTransform(y, [0, threshold * 0.4, threshold], [0, 0.5, 1]);
  const indicatorRotate = useTransform(y, [0, threshold], [0, 180]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const startYRef = React.useRef<number | null>(null);
  const pullingRef = React.useRef(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const reset = React.useCallback(() => {
    animate(y, 0, { type: "spring", stiffness: 380, damping: 32 });
    pullingRef.current = false;
    startYRef.current = null;
  }, [y]);

  const trigger = React.useCallback(async () => {
    setRefreshing(true);
    animate(y, threshold, { type: "spring", stiffness: 380, damping: 32 });
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      reset();
    }
  }, [onRefresh, reset, threshold, y]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pullingRef.current || startYRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) {
      y.set(0);
      return;
    }
    // Rubber-band: divide by 2 past threshold.
    const eased = dy < threshold ? dy : threshold + (dy - threshold) / 2;
    y.set(Math.min(eased, maxPull));
  };

  const onTouchEnd = () => {
    if (!pullingRef.current) return;
    if (y.get() >= threshold) {
      void trigger();
    } else {
      reset();
    }
    pullingRef.current = false;
    startYRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto overscroll-contain", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2"
        style={{ y: indicatorY, opacity: indicatorOpacity }}
      >
        <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-md border border-border/40">
          {refreshing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <motion.span style={{ rotate: indicatorRotate }}>
              <RefreshCcw size={13} />
            </motion.span>
          )}
          {refreshing ? "Atualizando" : "Puxe para atualizar"}
        </div>
      </motion.div>

      <motion.div style={{ y: indicatorY }}>{children}</motion.div>
    </div>
  );
}
