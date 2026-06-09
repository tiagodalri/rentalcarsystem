import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PencilLine, Sparkles, ArrowRight } from "lucide-react";
import { BookingWizard } from "@/components/admin/booking-wizard/BookingWizard";

type Mode = "manual" | "ai";

export default function AdminBookingNew() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode | null>(null);
  const back = () => navigate("/admin/bookings");

  if (mode) {
    return (
      <BookingWizard
        aiMode={mode === "ai"}
        onDone={back}
        onCancel={() => setMode(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Voltar para Reservas
      </button>

      <header className="space-y-1.5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Nova reserva
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Registrar a reserva
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha como deseja iniciar o registro da nova reserva.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setMode("manual")}
          className="group text-left rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:bg-card/80 transition-all p-6 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <PencilLine size={20} className="text-foreground/80 group-hover:text-primary transition-colors" />
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Manualmente</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você preenche todos os dados em 7 etapas guiadas.
            </p>
          </div>
        </button>

        <button
          onClick={() => setMode("ai")}
          className="group text-left rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary/60 transition-all p-6 flex flex-col gap-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-between relative z-10">
            <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <Sparkles size={20} className="text-primary" />
            </div>
            <ArrowRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Utilizar Auxiliar de IA</h2>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                Recomendado
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Primeiro a IA lê seus prints/PDFs/áudio/texto e pré-preenche tudo. Depois você confirma campo a campo nas etapas.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
