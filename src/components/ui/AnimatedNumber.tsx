import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  /** Target numeric value to animate to. */
  value: number;
  /** Animation duration in ms (default 700). */
  duration?: number;
  /** Optional formatter — receives current animated value, returns display string.
   *  Default: integer with locale grouping (pt-BR). */
  format?: (n: number) => string;
  /** Decimal places when no formatter (default 0). */
  decimals?: number;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Ticker / count-up animation for KPI numbers.
 * - First mount: animates from 0 to value (catches the eye on dashboard load).
 * - Updates: animates from previous value to new value.
 * - Respects prefers-reduced-motion: renders final value instantly.
 * - Uses tabular-nums for stable digit width during animation.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  format,
  decimals = 0,
  className = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }, []);

  useEffect(() => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    if (reducedMotion.current) {
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration]);

  const formatted = format
    ? format(display)
    : display.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return <span className={`tabular-nums ${className}`}>{formatted}</span>;
}
