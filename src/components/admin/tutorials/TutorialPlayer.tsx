import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Check, ExternalLink, X, Sparkles, Command } from "lucide-react";
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
  const hoverLeaveTimer = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setActiveHotspot(null);
    }
  }, [open, tutorial?.id]);

  useEffect(() => setActiveHotspot(null), [step]);

  const total = tutorial?.steps.length ?? 0;
  const isLast = step === total - 1;

  const goNext = useCallback(() => {
    if (!tutorial) return;
    if (isLast) {
      onComplete(tutorial.id);
      onClose();
    } else {
      setStep((s) => Math.min(tutorial.steps.length - 1, s + 1));
    }
  }, [tutorial, isLast, onComplete, onClose]);

  const goPrev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  useEffect(() => {
    if (!open || !tutorial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); goPrev(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tutorial, onClose, goNext, goPrev]);

  // Preload adjacent step images for instant transitions
  useEffect(() => {
    if (!tutorial) return;
    const refs = [tutorial.steps[step + 1]?.imageRef, tutorial.steps[step - 1]?.imageRef];
    refs.forEach((r) => {
      if (r && TUTORIAL_SCREENS[r]) {
        const img = new Image();
        img.src = TUTORIAL_SCREENS[r];
      }
    });
  }, [tutorial, step]);

  useEffect(() => () => {
    if (hoverLeaveTimer.current) window.clearTimeout(hoverLeaveTimer.current);
  }, []);

  const setHotspotSafe = useCallback((n: number | null) => {
    if (hoverLeaveTimer.current) {
      window.clearTimeout(hoverLeaveTimer.current);
      hoverLeaveTimer.current = null;
    }
    if (n === null) {
      hoverLeaveTimer.current = window.setTimeout(() => setActiveHotspot(null), 90);
    } else {
      setActiveHotspot(n);
    }
  }, []);

  const paragraphs = useMemo(() => {
    if (!tutorial) return [];
    const body = tutorial.steps[step]?.body ?? "";
    return body.split(/\n{2,}|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id, step]);

  if (!tutorial) return null;

  const current = tutorial.steps[step];
  const Icon = tutorial.icon;
  const screenSrc = current.imageRef ? TUTORIAL_SCREENS[current.imageRef] : undefined;
  const hasImage = !!screenSrc;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-border/40 bg-background [&>button]:hidden",
          "max-w-[1360px] w-[97vw] h-[92vh] rounded-3xl flex flex-col",
          "shadow-[0_60px_160px_-40px_rgba(0,0,0,0.7)]"
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{tutorial.title}</DialogTitle>
        <DialogDescription className="sr-only">{tutorial.summary}</DialogDescription>

        {/* close pinned top-right (over everything) */}
        <button
          onClick={onClose}
          aria-label="Fechar tutorial"
          className="absolute right-5 top-5 z-30 h-9 w-9 rounded-full bg-background/70 backdrop-blur-md border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* MAIN GRID */}
        <div
          className={cn(
            "flex-1 min-h-0 grid",
            hasImage
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(460px,1fr)]"
              : "grid-cols-1"
          )}
        >
          {/* ═════════ STAGE (cinema) ═════════ */}
          {hasImage && (
            <section onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="relative min-w-0 overflow-hidden bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.05),transparent_50%),linear-gradient(135deg,hsl(var(--muted)/0.4),hsl(var(--background)))]">
              {/* grid texture */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                }}
              />

              {/* category chip. top-left */}
              <div className="absolute left-7 top-7 z-10 flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-background/80 backdrop-blur-md border border-border/40 flex items-center justify-center shadow-sm">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.7} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[9.5px] font-semibold tracking-[0.28em] uppercase text-primary/80">
                    {tutorial.category}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Tutorial guiado
                  </span>
                </div>
              </div>

              {/* hotspots count badge. bottom-left */}
              {current.hotspots && current.hotspots.length > 0 && (
                <div className="absolute left-7 bottom-6 z-10 inline-flex items-center gap-2 h-7 px-3 rounded-full bg-background/75 backdrop-blur-md border border-border/40 text-[10.5px] tracking-[0.18em] uppercase text-foreground/70">
                  <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
                  {current.hotspots.length} {current.hotspots.length === 1 ? "marcação" : "marcações"}
                </div>
              )}

              {/* Screenshot. fills the stage with breathing margins */}
              <div className="absolute inset-0 pt-24 pb-20 px-8 lg:px-12 flex items-center justify-center">
                <div className="relative w-full h-full max-w-[920px] flex items-center justify-center">
                  {/* halo glow behind */}
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-primary/12 via-transparent to-primary/8 blur-3xl scale-95 opacity-70 pointer-events-none"
                  />
                  <div className="relative w-full h-full rounded-[20px] overflow-hidden border border-border/40 bg-background shadow-[0_30px_80px_-25px_rgba(0,0,0,0.45)]">
                    <AnnotatedScreenshot
                      src={screenSrc!}
                      alt={`Tela. ${current.title}`}
                      hotspots={current.hotspots}
                      activeN={activeHotspot}
                      onHotspotEnter={(n) => setHotspotSafe(n)}
                      onHotspotLeave={() => setHotspotSafe(null)}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═════════ INSTRUÇÕES ═════════ */}
          <aside className="relative min-w-0 flex flex-col bg-card/40 border-t lg:border-t-0 lg:border-l border-border/40">
            {/* Top: title block */}
            <div className="shrink-0 px-8 lg:px-10 pt-10 pb-5">
              <div className="flex items-baseline gap-3 mb-5">
                <span className="text-[42px] font-light text-primary/90 leading-none tabular-nums tracking-tight">
                  {String(step + 1).padStart(2, "0")}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground/70 tracking-[0.22em] uppercase">
                  / {String(total).padStart(2, "0")} passos
                </span>
              </div>

              <h2 className="text-[26px] lg:text-[30px] font-semibold text-foreground leading-[1.15] tracking-[-0.022em] [text-wrap:balance]">
                {current.title}
              </h2>

              <div className="mt-3 text-[11px] tracking-[0.18em] uppercase text-muted-foreground/70 truncate">
                {tutorial.title}
              </div>
            </div>

            {/* Scroll body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-8 lg:px-10 pb-8">
              <div className="space-y-4 text-[15px] leading-[1.65] text-foreground/80">
                {paragraphs.map((p, i) => (
                  <p key={i} className={i === 0 ? "text-[15.5px] text-foreground/90" : undefined}>
                    {p}
                  </p>
                ))}
              </div>

              {current.hotspots && current.hotspots.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-px flex-1 bg-border/60" />
                    <span className="text-[10px] font-semibold tracking-[0.24em] uppercase text-muted-foreground/80">
                      O que observar
                    </span>
                    <span className="h-px flex-1 bg-border/60" />
                  </div>
                  <ol className="space-y-1.5">
                    {current.hotspots.map((hs) => {
                      const isActive = activeHotspot === hs.n;
                      return (
                        <li
                          key={hs.n}
                          onPointerEnter={() => setHotspotSafe(hs.n)}
                          onPointerLeave={() => setHotspotSafe(null)}
                          className={cn(
                            "group flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-default transition-all border",
                            isActive
                              ? "border-primary/45 bg-primary/[0.07]"
                              : "border-transparent hover:border-border/60 hover:bg-muted/40"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-all",
                              isActive
                                ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                                : "bg-muted text-foreground/70 group-hover:bg-foreground/10"
                            )}
                          >
                            {hs.n}
                          </span>
                          <span className="text-[13.5px] leading-[1.55] text-foreground/85 pt-0.5">
                            {hs.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {current.highlights && current.highlights.length > 0 && (
                <ul className="mt-7 space-y-2.5">
                  {current.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-3 text-[14px] leading-[1.55] text-foreground/80"
                    >
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}

              {current.caption && (
                <div className="mt-7 relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent p-5">
                  <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-2 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                    <span className="text-[10px] font-semibold tracking-[0.22em] text-primary/85 uppercase">
                      Dica de quem opera
                    </span>
                  </div>
                  <p className="relative text-[13.5px] leading-[1.6] text-foreground/85">
                    {current.caption}
                  </p>
                </div>
              )}

              {current.cta && (
                <button
                  onClick={() => {
                    onClose();
                    navigate(current.cta!.to);
                  }}
                  className="mt-7 group inline-flex items-center gap-2 px-5 h-11 rounded-full bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                  {current.cta.label}
                  <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>

            {/* Footer / controls */}
            <footer className="shrink-0 border-t border-border/40 bg-background/85 backdrop-blur-xl px-6 lg:px-8 py-3.5">
              {/* segmented progress bar */}
              <div className="flex items-center gap-1 mb-3">
                {tutorial.steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Ir para o passo ${i + 1}`}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-500",
                      i < step && "bg-primary/70",
                      i === step && "bg-primary",
                      i > step && "bg-muted-foreground/15 hover:bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={step === 0}
                  className="h-10 px-4 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </button>

                <div className="hidden sm:flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase text-muted-foreground/70">
                  <kbd className="h-5 px-1.5 rounded border border-border/60 bg-muted/50 inline-flex items-center font-mono text-[9.5px]">
                    <Command className="h-2.5 w-2.5" />
                  </kbd>
                  <span>← →</span>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="h-10 px-5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.55)]"
                >
                  {isLast ? "Concluir tutorial" : "Próximo passo"}
                  {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
