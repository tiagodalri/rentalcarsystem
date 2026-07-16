import { Compass } from "lucide-react";
import { useGuidedTour } from "./GuidedTourContext";
import { SHOW_PRESENTATION_CONTROLS } from "@/lib/demo/config";

/**
 * Botão de gatilho do Tour Guiado — colocar no header do Painel,
 * ao lado do PresentationModeButton.
 */
export default function GuidedTourButton() {
  const { start } = useGuidedTour();
  return (
    <button
      onClick={start}
      className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-[12.5px] font-semibold transition-transform hover:-translate-y-[1px]"
      style={{
        background: "#0d1d2e",
        color: "#9a7a3a",
        border: "1px solid #9a7a3a",
        boxShadow: "0 4px 12px -4px rgba(13,29,46,0.35)",
      }}
      title="Iniciar tour guiado de vendas"
    >
      <Compass className="h-3.5 w-3.5" />
      Tour Guiado
    </button>
  );
}
