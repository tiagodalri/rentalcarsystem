import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TOUR_STEPS } from "./tourSteps";
import { useGuidedTour } from "./GuidedTourContext";
import PriceCard from "./PriceCard";

const NAVY = "#0d1d2e";
const GOLD = "#9a7a3a";
const MISSION =
  "Não entregamos apenas um sistema. Nós entregamos visão, informação, controle e escala pra sua operação.";


/**
 * GuidedTour — overlay de apresentação do sistema para vendas.
 * Ofusca a tela real (que continua visível ~30% atrás), mostra o
 * roteiro em um cartão elegante navy/dourado, e permite ao apresentador
 * "Explorar ao vivo" e voltar ao mesmo ato.
 */
export default function GuidedTour() {
  const { active, overlayVisible, index, next, prev, goTo, stop, hideOverlay, showOverlay } =
    useGuidedTour();
  const queryClient = useQueryClient();

  const step = TOUR_STEPS[index];
  const [fleetCount, setFleetCount] = useState<string>("15");
  const [fleetBusy, setFleetBusy] = useState(false);
  const [fleetDone, setFleetDone] = useState<number | null>(null);
  const [fleetProgress, setFleetProgress] = useState(0);
  const [fleetStage, setFleetStage] = useState<string>("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    if (stageTimer.current) { clearInterval(stageTimer.current); stageTimer.current = null; }
  };

  useEffect(() => () => clearTimers(), []);

  // Warm-up: quando o ato de abertura aparece, dispara consulta leve
  // pra acordar a conexão do banco antes do clique em "Montar minha frota".
  const warmedRef = useRef(false);
  useEffect(() => {
    if (!active || warmedRef.current) return;
    const stepId = TOUR_STEPS[index]?.id;
    if (stepId !== "abertura") return;
    warmedRef.current = true;
    void supabase.from("vehicles").select("id").limit(1).then(() => {}, () => {});
  }, [active, index]);

  const handleBuildFleet = async () => {
    const n = parseInt(fleetCount, 10);
    if (!Number.isFinite(n) || n < 1 || n > 105) {
      toast.error("Digite um número entre 1 e 105");
      return;
    }
    setFleetBusy(true);
    setFleetDone(null);
    setFleetProgress(4);
    const stages = ["Analisando veículos", "Agrupando métricas", "Montando o cenário"];
    setFleetStage(stages[0]);
    let stageIdx = 0;
    stageTimer.current = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      setFleetStage(stages[stageIdx]);
    }, 900);
    progressTimer.current = setInterval(() => {
      setFleetProgress((p) => (p < 90 ? p + Math.max(1, Math.round((92 - p) / 12)) : p));
    }, 180);

    const startedAt = Date.now();

    // Retry transparente: a 1a tentativa costuma falhar por conexão fria
    // (statement timeout). A RPC é idempotente — restaura e re-seleciona —
    // então repetir é seguro. Só reportamos erro se as 3 tentativas falharem.
    const MAX_ATTEMPTS = 3;
    let data: any = null;
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await supabase.rpc("demo_start_presentation" as any, { p_count: n });
      if (!res.error) {
        data = res.data;
        lastError = null;
        break;
      }
      lastError = res.error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Tempo mínimo de 2s pra dar sensação de gamificação
    const elapsed = Date.now() - startedAt;
    if (elapsed < 2000) await new Promise((r) => setTimeout(r, 2000 - elapsed));

    clearTimers();

    if (lastError) {
      setFleetBusy(false);
      setFleetProgress(0);
      setFleetStage("");
      toast.error("Não foi possível montar a frota", { description: lastError.message });
      return;
    }

    setFleetProgress(100);
    const kept = (data as any)?.kept ?? n;
    setFleetDone(kept);
    setFleetBusy(false);
    setFleetStage("Frota criada");
    // Atualiza dados por baixo — sem recarregar a página
    await queryClient.invalidateQueries();
  };


  // Atalhos de teclado
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      if (!overlayVisible) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, overlayVisible, next, prev, stop]);

  if (!active || !step) return null;

  const total = TOUR_STEPS.length;

  return createPortal(
    <>
      {/* Overlay principal */}
      {overlayVisible && (
        <div
          className="fixed inset-0 z-[9998] flex flex-col animate-fade-in"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(13,29,46,0.72), rgba(5,10,18,0.86))",
            backdropFilter: "blur(2px)",
          }}
        >
          {/* Barra de atos (bullets) */}
          <div
            className="flex-none border-b"
            style={{
              background: `linear-gradient(180deg, ${NAVY} 0%, rgba(13,29,46,0.92) 100%)`,
              borderColor: "rgba(154,122,58,0.35)",
            }}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 pr-3 mr-1 border-r border-white/10">
                <Compass className="h-4 w-4" style={{ color: GOLD }} />
                <span
                  className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                  style={{ color: GOLD }}
                >
                  Tour Guiado
                </span>
              </div>
              <div className="flex-1 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
                {TOUR_STEPS.map((s, i) => {
                  const isActive = i === index;
                  const isPast = i < index;
                  return (
                    <button
                      key={s.id}
                      onClick={() => goTo(i)}
                      className="group flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-md text-[11.5px] transition-all"
                      style={{
                        color: isActive ? GOLD : isPast ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.45)",
                        background: isActive ? "rgba(154,122,58,0.12)" : "transparent",
                        border: isActive ? `1px solid ${GOLD}` : "1px solid transparent",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-semibold tabular-nums"
                        style={{
                          background: isActive ? GOLD : isPast ? "rgba(154,122,58,0.35)" : "rgba(255,255,255,0.08)",
                          color: isActive ? NAVY : "rgba(255,255,255,0.9)",
                        }}
                      >
                        {i + 1}
                      </span>
                      {s.bullet}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={stop}
                aria-label="Encerrar tour"
                className="ml-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Cartão central — clicar fora esconde o overlay para explorar a tela real */}
          {step.kind === "price" ? (
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
              onClick={(e) => {
                if (e.target === e.currentTarget) hideOverlay();
              }}
            >
              <div
                className="min-h-full flex items-center justify-center px-4 py-6 sm:py-10"
                onClick={(e) => {
                  if (e.target === e.currentTarget) hideOverlay();
                }}
              >
                <PriceCard
                  step={step}
                  index={index}
                  total={total}
                  onPrev={prev}
                  onNext={next}
                  onStop={stop}
                  intoFleetCount={parseInt(fleetCount, 10) || 15}
                />
              </div>
            </div>
          ) : (
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) hideOverlay();
            }}
          >
          <div
            className="min-h-full flex items-center justify-center px-4 py-8 sm:py-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) hideOverlay();
            }}
          >
            <div
              key={step.id}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl animate-fade-in"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #faf7f0 100%)",
                border: `1px solid rgba(154,122,58,0.35)`,
                borderRadius: 18,
                boxShadow:
                  "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
                padding: "clamp(28px, 5vw, 56px)",
              }}
            >
              {/* faixa dourada superior */}
              <div
                className="absolute inset-x-10 top-0 h-[3px] rounded-b-full"
                style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
              />

              {/* Bloco NOSSA MISSÃO (frase completa apenas fora do intro) */}
              {step.kind !== "intro" && (
                <div
                  className="mb-6 pb-4 border-b"
                  style={{ borderColor: "rgba(154,122,58,0.2)" }}
                >
                  <div
                    className="text-[9.5px] font-semibold tracking-[0.32em] uppercase mb-1.5"
                    style={{ color: GOLD }}
                  >
                    Nossa Missão
                  </div>
                  <p
                    className="leading-snug"
                    style={{
                      color: "rgba(13,29,46,0.72)",
                      fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                      fontSize: "clamp(11.5px, 1vw, 12.5px)",
                      fontWeight: 500,
                      maxWidth: "62ch",
                    }}
                  >
                    {MISSION}
                  </p>
                </div>
              )}


              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[10px] font-semibold tracking-[0.28em] uppercase"
                  style={{ color: GOLD }}
                >
                  Ato {index + 1} de {total} · {step.bullet}
                </span>
              </div>

              {step.kind === "intro" ? (
                <div>
                  {step.eyebrow && (
                    <div
                      className="text-[10.5px] font-semibold tracking-[0.32em] uppercase mb-4"
                      style={{ color: GOLD }}
                    >
                      {step.eyebrow}
                    </div>
                  )}
                  {step.brand && (
                    <h2
                      className="leading-[1] tracking-[-0.03em]"
                      style={{
                        color: NAVY,
                        fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                        fontSize: "clamp(38px, 6vw, 62px)",
                        fontWeight: 800,
                      }}
                    >
                      {step.brand}
                    </h2>
                  )}
                  {step.statement && (
                    <div className="mt-6">
                      <div
                        className="text-[9.5px] font-semibold tracking-[0.32em] uppercase mb-2"
                        style={{ color: GOLD }}
                      >
                        Nossa Missão
                      </div>
                      <p
                        className="leading-[1.25]"
                        style={{
                          color: NAVY,
                          fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                          fontSize: "clamp(18px, 2.1vw, 24px)",
                          fontWeight: 600,
                          maxWidth: "58ch",
                        }}
                      >
                        {step.statement}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <h2
                  style={{
                    color: NAVY,
                    fontFamily: "'Urbanist', 'Inter', system-ui, -apple-system, sans-serif",
                    fontSize: "clamp(22px, 3.2vw, 33px)",
                    fontWeight: 700,
                    lineHeight: 1.12,
                    letterSpacing: "-0.02em",
                    maxWidth: "24ch",
                    textWrap: "balance",
                  }}
                >
                  {step.title}
                </h2>
              )}

              <ul
                className={
                  "mt-6 " +
                  (step.pains.length >= 5
                    ? "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3"
                    : "space-y-3")
                }
                style={step.pains.length >= 5 ? undefined : { maxWidth: "62ch" }}
              >
                {step.pains.map((pain, i) => (
                  <li
                    key={i}
                    className="flex gap-3 items-start leading-snug"
                    style={{
                      color: "#2a2a2a",
                      fontSize:
                        step.pains.length >= 5
                          ? "clamp(13.5px, 1.25vw, 15px)"
                          : "clamp(14.5px, 1.45vw, 16.5px)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="mt-[9px] shrink-0 rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        background: GOLD,
                        boxShadow: `0 0 0 3px ${GOLD}22`,
                      }}
                    />
                    <span>{pain}</span>
                  </li>
                ))}
              </ul>

              <p
                className="mt-6 pt-4 border-t leading-snug"
                style={{
                  color: NAVY,
                  borderColor: "rgba(154,122,58,0.28)",
                  fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                  fontSize: "clamp(14.5px, 1.5vw, 17px)",
                  fontWeight: 600,
                  fontStyle: "italic",
                  maxWidth: "62ch",
                }}
              >
                <span
                  aria-hidden
                  className="inline-block mr-3 align-middle rounded-full"
                  style={{ width: 6, height: 6, background: GOLD }}
                />
                {step.teaser}
              </p>

              {/* Caixa "quantos carros" — apenas no ato de abertura */}
              {step.kind === "intro" && (
                <div
                  className="mt-8 rounded-2xl overflow-hidden"
                  style={{
                    background: `linear-gradient(180deg, ${NAVY} 0%, #0a1726 100%)`,
                    border: `1px solid ${GOLD}`,
                    boxShadow: "0 20px 40px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(154,122,58,0.15) inset",
                  }}
                >
                  <div className="p-5 sm:p-6">
                    <div
                      className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.28em] uppercase mb-2"
                      style={{ color: GOLD }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Personalizar sua frota
                    </div>
                    <div
                      className="leading-snug mb-4"
                      style={{
                        color: "#f4ead1",
                        fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                        fontSize: "clamp(17px, 1.9vw, 21px)",
                        fontWeight: 600,
                      }}
                    >
                      Quantos carros você tem na frota hoje?
                    </div>
                    {fleetBusy ? (
                      <div
                        className="rounded-xl p-5 animate-fade-in"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid rgba(154,122,58,0.35)`,
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: "#f4ead1", fontFamily: "'Urbanist', 'Inter', sans-serif" }}
                          >
                            Montando sua frota...
                          </span>
                          <span
                            className="ml-auto text-[12px] tabular-nums font-semibold"
                            style={{ color: GOLD }}
                          >
                            {fleetProgress}%
                          </span>
                        </div>
                        <div
                          className="h-[6px] w-full rounded-full overflow-hidden mb-3"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <div
                            className="h-full transition-all duration-300 ease-out"
                            style={{
                              width: `${fleetProgress}%`,
                              background: `linear-gradient(90deg, ${GOLD}, #d6bf86)`,
                              boxShadow: `0 0 12px ${GOLD}66`,
                            }}
                          />
                        </div>
                        <div
                          className="text-[11.5px] tracking-wide"
                          style={{ color: "rgba(244,234,209,0.7)" }}
                        >
                          {fleetStage}
                        </div>
                      </div>
                    ) : fleetDone != null ? (
                      <div
                        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in"
                        style={{
                          background: "rgba(154,122,58,0.10)",
                          border: `1px solid ${GOLD}`,
                        }}
                      >
                        <div
                          className="inline-flex items-center justify-center h-9 w-9 rounded-full shrink-0"
                          style={{ background: GOLD, color: NAVY }}
                        >
                          <Check className="h-5 w-5" strokeWidth={3} />
                        </div>
                        <div className="flex-1">
                          <div
                            className="text-[13.5px] font-semibold"
                            style={{ color: "#f4ead1", fontFamily: "'Urbanist', 'Inter', sans-serif" }}
                          >
                            Frota criada
                          </div>
                          <div className="text-[11.5px]" style={{ color: "rgba(244,234,209,0.7)" }}>
                            {fleetDone} veículos prontos.
                          </div>
                        </div>
                        <button
                          onClick={next}
                          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md text-[13px] font-semibold transition-transform hover:-translate-y-[1px]"
                          style={{
                            background: GOLD,
                            color: NAVY,
                            border: `1px solid ${GOLD}`,
                            boxShadow: `0 0 0 3px ${GOLD}33`,
                          }}
                        >
                          Iniciar
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
                        <input
                          type="number"
                          min={1}
                          max={105}
                          value={fleetCount}
                          onChange={(e) => setFleetCount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleBuildFleet();
                          }}
                          placeholder="Ex: 15"
                          className="h-11 w-full sm:w-32 rounded-md px-3 text-[15px] tabular-nums outline-none transition-colors"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: `1px solid rgba(154,122,58,0.45)`,
                            color: "#faf7f0",
                            fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
                            fontWeight: 600,
                          }}
                        />
                        <button
                          onClick={handleBuildFleet}
                          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md text-[13px] font-semibold transition-transform hover:-translate-y-[1px]"
                          style={{
                            background: GOLD,
                            color: NAVY,
                            border: `1px solid ${GOLD}`,
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Montar minha frota
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={prev}
                  disabled={index === 0}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    color: NAVY,
                    border: `1px solid rgba(13,29,46,0.25)`,
                    background: "transparent",
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>

                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md text-[13px] font-semibold shadow-sm transition-transform hover:-translate-y-[1px]"
                  style={{
                    background: NAVY,
                    color: GOLD,
                    border: `1px solid ${GOLD}`,
                    boxShadow:
                      step.kind === "intro" && fleetDone != null
                        ? `0 0 0 3px ${GOLD}33`
                        : undefined,
                  }}
                >
                  {index === total - 1 ? "Encerrar" : "Avançar"}
                  {index < total - 1 && <ArrowRight className="h-3.5 w-3.5" />}
                </button>

                <span
                  className="ml-auto text-[11px] leading-tight text-right"
                  style={{ color: "rgba(13,29,46,0.55)" }}
                >
                  Clique fora do cartão para explorar esta tela ao vivo.
                </span>
              </div>

              {/* Progresso */}
              <div className="mt-6 h-[3px] w-full rounded-full overflow-hidden" style={{ background: "rgba(13,29,46,0.08)" }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${((index + 1) / total) * 100}%`,
                    background: `linear-gradient(90deg, ${GOLD}, ${NAVY})`,
                  }}
                />
              </div>
            </div>
          </div>
          </div>
          )}
        </div>
      )}

      {/* FAB "Voltar ao tour" quando o overlay está oculto */}
      {!overlayVisible && (
        <button
          onClick={showOverlay}
          className="fixed z-[9999] bottom-6 right-6 inline-flex items-center gap-2 h-12 px-5 rounded-full text-[13px] font-semibold shadow-xl animate-fade-in hover:-translate-y-[1px] transition-transform"
          style={{
            background: NAVY,
            color: GOLD,
            border: `1px solid ${GOLD}`,
            boxShadow: "0 12px 30px -8px rgba(0,0,0,0.5)",
          }}
        >
          <Compass className="h-4 w-4" />
          Voltar ao tour
          <span
            className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] tabular-nums"
            style={{ background: GOLD, color: NAVY }}
          >
            {index + 1}/{TOUR_STEPS.length}
          </span>
        </button>
      )}
    </>,
    document.body,
  );
}
