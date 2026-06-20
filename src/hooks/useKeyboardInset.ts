import { useEffect, useState } from "react";

/**
 * Tracks the height of the virtual keyboard on mobile via visualViewport API.
 * Returns the number of pixels the keyboard is currently covering at the
 * bottom of the viewport (0 when closed or on desktop).
 *
 * Used by StickyActionBar so primary CTAs rise above the keyboard instead of
 * being hidden behind it — matching native iOS/Android behavior.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Difference between layout viewport and visual viewport ≈ keyboard height.
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setInset(diff > 80 ? diff : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
