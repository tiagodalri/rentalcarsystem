import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TOUR_STEPS } from "./tourSteps";
import { useGuidedTour } from "./GuidedTourContext";

const NAVY = "#0d1d2e";
const GOLD = "#9a7a3a";
const MISSION =
  "Não entregamos um sistema, entregamos visão, informação e escala da sua operação.";


/**
 * GuidedTour — overlay de apresentação do sistema para vendas.
 * Ofusca a tela real (que continua visível ~30% atrás), mostra o
 * roteiro em um cartão elegante navy/dourado, e permite ao apresentador
 * "Explorar ao vivo" e voltar ao mesmo ato.
 */
export default function GuidedTour() {
  const { active, overlayVisible, index, next, prev, goTo, stop, hideOverlay, showOverlay } =
    useGuidedTour();

  const step = TOUR_STEPS[index];

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

          {/* Cartão central */}
          <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-10">
            <div
              key={step.id}
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

              <div className="flex items-center gap-3 mb-5">
                <span
                  className="text-[10px] font-semibold tracking-[0.28em] uppercase"
                  style={{ color: GOLD }}
                >
                  Ato {index + 1} de {total} · {step.bullet}
                </span>
                {step.climax && (
                  <span
                    className="text-[9px] font-semibold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full"
                    style={{ background: NAVY, color: GOLD, border: `1px solid ${GOLD}` }}
                  >
                    Clímax
                  </span>
                )}
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
                    <p
                      className="mt-6 leading-[1.25]"
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
                  )}
                </div>
              ) : (
                <h2
                  className="leading-[1.05] tracking-[-0.025em]"
                  style={{
                    color: NAVY,
                    fontFamily: "'Urbanist', 'Inter', system-ui, -apple-system, sans-serif",
                    fontSize: step.climax ? "clamp(30px, 4.6vw, 46px)" : "clamp(26px, 4vw, 40px)",
                    fontWeight: 700,
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
                  }}
                >
                  {index === total - 1 ? "Encerrar" : "Avançar"}
                  {index < total - 1 && <ArrowRight className="h-3.5 w-3.5" />}
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={hideOverlay}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-[12.5px] font-medium transition-colors"
                    style={{
                      color: NAVY,
                      background: `${GOLD}22`,
                      border: `1px solid ${GOLD}`,
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Explorar ao vivo
                  </button>
                </div>
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
