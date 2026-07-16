import { Play } from "lucide-react";
import { useGuidedTour } from "./guided-tour/GuidedTourContext";

/** Botão-ícone discreto no header do admin que dispara o Tour Guiado. */
export default function GuidedTourIconButton() {
  const { start } = useGuidedTour();
  return (
    <button
      type="button"
      onClick={start}
      title="Iniciar tour guiado"
      aria-label="Iniciar tour guiado"
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors flex items-center justify-center"
    >
      <Play className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
