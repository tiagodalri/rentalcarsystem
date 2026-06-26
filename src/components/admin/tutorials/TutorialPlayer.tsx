import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Check, ExternalLink, X, Lightbulb } from "lucide-react";
import type { Tutorial } from "@/data/adminTutorials";
import { TUTORIAL_SCREENS } from "@/data/tutorialScreens";
import { AnnotatedScreenshot } from "./AnnotatedScreenshot";
import { cn } from "@/lib/utils";

interface TutorialPlayerProps {
  tutorial: Tutorial | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
}

export function TutorialPlayer({ tutorial, open, onClose, onComplete }: TutorialPlayerProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setActiveHotspot(null);
    }
  }, [open, tutorial?.id]);

  useEffect(() => setActiveHotspot(null), [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !tutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(tutorial.steps.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tutorial]);

  if (!tutorial) return null;

  const total = tutorial.steps.length;
  const current = tutorial.steps[step];
  const isLast = step === total - 1;
  const progress = ((step + 1) / total) * 100;
  const Icon = tutorial.icon;

  const screenSrc = current.imageRef ? TUTORIAL_SCREENS[current.imageRef] : undefined;
  const hasImage = !!screenSrc;

  // Split body into paragraphs (visual rhythm — no walls of text)
  const paragraphs = current.body.split(/\n{2,}|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).filter(Boolean);

  const next = () => {
    if (isLast) {
      onComplete(tutorial.id);
      onClose();
    } else setStep((s) => Math.min(total - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-border/40 bg-background [&>button]:hidden",
          "max-w-[1280px] w-[96vw] h-[92vh] sm:h-[90vh] flex flex-col rounded-2xl",
          "shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)]"
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{tutorial.title}</DialogTitle>
        <DialogDescription className="sr-only">{tutorial.summary}</DialogDescription>

        {/* ───── Header ───── */}
        <header className="shrink-0 relative px-6 sm:px-9 pt-5 pb-4 border-b border-border/30 bg-background/80 backdrop-blur-xl">
          <button
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="absolute right-4 top-4 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="flex items-center gap-3.5 pr-12">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/25 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold tracking-[0.24em] text-primary/70 uppercase mb-0.5">
                {tutorial.category} · {String(step + 1).padStart(2, "0")} de {String(total).padStart(2, "0")}
              </div>
              <h2 className="text-[16px] sm:text-[17px] font-semibold text-foreground leading-tight tracking-[-0.01em] truncate">
                {tutorial.title}
              </h2>
            </div>
          </div>

          {/* progress hairline */}
          <div className="mt-4 h-[2px] rounded-full bg-muted/70 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/80 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {/* ───── Body: split panel ───── */}
        <div className={cn("flex-1 min-h-0 grid", hasImage ? "lg:grid-cols-[1.55fr_1fr]" : "grid-cols-1")}>
          {/* Image pane (sticky on desktop) */}
          {hasImage && (
            <div className="relative bg-gradient-to-br from-muted/40 via-background to-muted/30 border-b lg:border-b-0 lg:border-r border-border/30 overflow-hidden">
              <div className="absolute inset-0 p-5 sm:p-8 lg:p-10 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                      Tela real do sistema
                    </span>
                  </div>
                  {current.hotspots && current.hotspots.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums">
                      {current.hotspots.length} {current.hotspots.length === 1 ? "marcação" : "marcações"}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <AnnotatedScreenshot
                    src={screenSrc!}
                    alt={`Tela — ${current.title}`}
                    hotspots={current.hotspots}
                    activeN={activeHotspot}
                    onHotspotEnter={setActiveHotspot}
                    onHotspotLeave={() => setActiveHotspot(null)}
                  />
                </div>

                {current.hotspots && current.hotspots.length > 0 && (
                  <p className="mt-4 text-center text-[11px] text-muted-foreground/70 leading-relaxed">
                    Passe o cursor sobre os marcadores numerados para destacar cada elemento na tela.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Text pane */}
          <div className="overflow-y-auto">
            <div className="px-6 sm:px-9 py-8 sm:py-10 max-w-[560px]">
              <div className="text-[10px] font-semibold tracking-[0.24em] uppercase text-primary/70 mb-3">
                Passo {String(step + 1).padStart(2, "0")}
              </div>
              <h3 className="text-[26px] sm:text-[30px] font-semibold text-foreground leading-[1.15] tracking-[-0.02em] mb-5">
                {current.title}
              </h3>

              <div className="space-y-3.5 text-[15px] leading-[1.65] text-foreground/75">
                {paragraphs.map((p, i) => (
                  <p key={i} className={i === 0 ? "text-foreground/85" : undefined}>
                    {p}
                  </p>
                ))}
              </div>

              {/* Hotspot legend */}
              {current.hotspots && current.hotspots.length > 0 && (
                <div className="mt-7">
                  <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground mb-3">
                    O que observar
                  </div>
                  <ol className="space-y-1.5">
                    {current.hotspots.map((hs) => {
                      const isActive = activeHotspot === hs.n;
                      return (
                        <li
                          key={hs.n}
                          onMouseEnter={() => setActiveHotspot(hs.n)}
                          onMouseLeave={() => setActiveHotspot(null)}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-all cursor-default",
                            isActive
                              ? "border-primary/50 bg-primary/[0.06] shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]"
                              : "border-transparent hover:border-border/60 hover:bg-muted/40"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-all",
                              isActive
                                ? "bg-primary text-primary-foreground scale-110"
                                : "bg-muted text-foreground/70"
                            )}
                          >
                            {hs.n}
                          </span>
                          <span className="text-[13.5px] leading-[1.5] text-foreground/85 pt-px">
                            {hs.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {current.highlights && current.highlights.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                  {current.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-[14px] text-foreground/80 leading-[1.55]">
                      <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" strokeWidth={2.2} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              {current.caption && (
                <div className="mt-7 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                    <span className="text-[10px] font-semibold tracking-[0.22em] text-primary/80 uppercase">
                      Dica do dia
                    </span>
                  </div>
                  <p className="text-[13.5px] text-foreground/80 leading-[1.6]">{current.caption}</p>
                </div>
              )}

              {current.cta && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(current.cta!.to);
                  }}
                  className="mt-7 group inline-flex items-center gap-2 px-4 h-10 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                  {current.cta.label}
                  <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ───── Footer ───── */}
        <footer className="shrink-0 px-5 sm:px-9 py-3.5 border-t border-border/30 bg-background/90 backdrop-blur-xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="h-10 px-4 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex items-center gap-1.5">
            {tutorial.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Ir para o passo ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            className="h-10 px-5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.5)]"
          >
            {isLast ? "Concluir" : "Próximo"}
            {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
