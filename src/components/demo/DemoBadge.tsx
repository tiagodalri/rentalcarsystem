import { Sparkles } from "lucide-react";
import { DEMO_MODE } from "@/lib/demo/config";

/**
 * Selo discreto indicando que o ambiente é demonstração.
 * Fixo no canto inferior direito, não intercepta cliques.
 */
export function DemoBadge() {
  if (!DEMO_MODE) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-[70] hidden md:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] shadow-lg"
      style={{
        background: "linear-gradient(135deg, rgba(13,29,46,0.92), rgba(20,40,61,0.92))",
        color: "#f3e6c4",
        border: "1px solid rgba(154,122,58,0.5)",
      }}
      aria-label="Ambiente de demonstração"
    >

      <Sparkles size={11} strokeWidth={2.4} />
      Demo
    </div>
  );
}
