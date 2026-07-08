import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

/**
 * Editorial page transition for admin routes.
 * Fade + subtle rise (8px). Respects prefers-reduced-motion.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      className="admin-page-motion"
    >
      {children}
    </motion.div>
  );
}
