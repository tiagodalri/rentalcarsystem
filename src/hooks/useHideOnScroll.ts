import { useEffect, useRef, useState } from "react";

/**
 * Tracks scroll direction with a small threshold to avoid jitter,
 * and reveals the header when near the top.
 *
 * Returns `hidden = true` when the header should slide up out of view.
 */
export function useHideOnScroll(options?: {
  /** Minimum scroll-Y where hiding starts. Below this, always show. */
  topOffset?: number;
  /** Pixels of movement required before flipping direction. */
  threshold?: number;
}) {
  const topOffset = options?.topOffset ?? 80;
  const threshold = options?.threshold ?? 8;
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const accum = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        lastY.current = y;

        // Always show near the top.
        if (y < topOffset) {
          accum.current = 0;
          setHidden(false);
          ticking.current = false;
          return;
        }

        // Accumulate movement in current direction; flip once past threshold.
        if ((dy > 0 && accum.current < 0) || (dy < 0 && accum.current > 0)) {
          accum.current = 0;
        }
        accum.current += dy;

        if (accum.current > threshold) {
          setHidden(true);
          accum.current = 0;
        } else if (accum.current < -threshold) {
          setHidden(false);
          accum.current = 0;
        }
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [topOffset, threshold]);

  return hidden;
}
