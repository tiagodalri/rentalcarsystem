import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, ExternalLink, X } from "lucide-react";
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

  useEffect(() => {
    setActiveHotspot(null);
  }, [step]);

  if (!tutorial) return null;

  const total = tutorial.steps.length;
  const current = tutorial.steps[step];
  const isLast = step === total - 1;
  const progress = ((step + 1) / total) * 100;
  const Icon = tutorial.icon;

  const screenSrc = current.imageRef ? TUTORIAL_SCREENS[current.imageRef] : undefined;
  const hasImage = !!screenSrc;

  const next = () => {
    if (isLast) {
      onComplete(tutorial.id);
      onClose();
    } else {
      setStep((s) => Math.min(total - 1, s + 1));
    }
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden border-border/40 bg-card gap-0 [&>button]:hidden",
          hasImage ? "max-w-[1180px] w-[96vw]" : "max-w-[680px]"
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{tutorial.title}</DialogTitle>
        <DialogDescription className="sr-only">{tutorial.summary}</DialogDescription>

        {/* Top bar */}
        <div className="relative px-5 sm:px-7 pt-5 pb-4 border-b border-border/30 bg-gradient-to-b from-primary/[0.04] to-transparent">
          <button
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="absolute right-3 top-3 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-semibold tracking-[0.22em] text-primary/80 uppercase mb-1">
                Tutorial · {tutorial.category}
              </div>
              <h2 className="text-[15px] sm:text-base font-semibold text-foreground leading-tight">
                {tutorial.title}
              </h2>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">
              {String(step + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className={cn(
            "max-h-[72vh] overflow-y-auto",
            hasImage ? "grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]" : ""
          )}
        >
          {/* Image column */}
          {hasImage && (
            <div className="p-4 sm:p-5 lg:p-6 bg-gradient-to-b from-background/60 to-muted/40 border-b lg:border-b-0 lg:border-r border-border/30">
              <div className="text-[9px] font-semibold tracking-[0.22em] text-muted-foreground uppercase mb-3">
                Print real do sistema
              </div>
              <AnnotatedScreenshot
                src={screenSrc!}
                alt={`Print da tela — ${current.title}`}
                hotspots={current.hotspots}
                activeN={activeHotspot}
                onHotspotEnter={setActiveHotspot}
                onHotspotLeave={() => setActiveHotspot(null)}
              />
              {current.hotspots && current.hotspots.length > 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed text-center">
                  Passe o mouse sobre os números <span className="text-primary font-medium">①②③</span> para destacar cada elemento.
                </p>
              )}
            </div>
          )}

          {/* Text column */}
          <div className={cn("px-5 sm:px-7 py-6", !hasImage && "max-h-[60vh] overflow-y-auto")}>
            <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary/70 mb-2">
              Passo {String(step + 1).padStart(2, "0")}
            </div>
            <h3 className="text-[18px] sm:text-[20px] font-semibold text-foreground leading-tight mb-3 tracking-[-0.01em]">
              {current.title}
            </h3>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              {current.body}
            </p>

            {/* Hotspot legend — numbered, matches overlay */}
            {current.hotspots && current.hotspots.length > 0 && (
              <ol className="mt-5 space-y-2">
                {current.hotspots.map((hs) => {
                  const isActive = activeHotspot === hs.n;
                  return (
                    <li
                      key={hs.n}
                      onMouseEnter={() => setActiveHotspot(hs.n)}
                      onMouseLeave={() => setActiveHotspot(null)}
                      className={cn(
                        "group flex items-start gap-3 rounded-lg border px-3 py-2 transition-all cursor-default",
                        isActive
                          ? "border-primary/60 bg-primary/[0.08]"
                          : "border-border/40 bg-background/40 hover:border-primary/30 hover:bg-primary/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/15 text-primary"
                        )}
                      >
                        {hs.n}
                      </span>
                      <span className="text-[12.5px] leading-snug text-foreground/85">
                        {hs.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {current.highlights && current.highlights.length > 0 && (
              <ul className="mt-4 space-y-2">
                {current.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-[13px] text-foreground/85">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}

            {current.caption && (
              <div className="mt-5 px-3.5 py-2.5 rounded-lg border border-primary/20 bg-primary/[0.04]">
                <div className="text-[11px] font-semibold tracking-[0.16em] text-primary/80 uppercase mb-1">
                  Dica
                </div>
                <p className="text-[12.5px] text-foreground/80 leading-relaxed">{current.caption}</p>
              </div>
            )}

            {current.cta && (
              <button
                onClick={() => {
                  onClose();
                  navigate(current.cta!.to);
                }}
                className="mt-5 inline-flex items-center gap-2 px-3.5 h-9 rounded-lg border border-primary/40 bg-primary/10 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {current.cta.label}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-border/30 bg-muted/20 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={prev}
            disabled={step === 0}
            className="h-9 text-[12.5px] gap-1.5 disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>

          <div className="hidden sm:flex items-center gap-1.5">
            {tutorial.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Ir para o passo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          <Button
            type="button"
            onClick={next}
            className="h-9 text-[12.5px] gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? (
              <>
                Concluir
                <Check className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
