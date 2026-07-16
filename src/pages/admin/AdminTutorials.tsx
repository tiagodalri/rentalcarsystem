import { useEffect, useMemo, useState } from "react";
import { adminTutorials, type Tutorial } from "@/data/adminTutorials";
import { TutorialPlayer } from "@/components/admin/tutorials/TutorialPlayer";
import { GraduationCap, Clock3, CheckCircle2, PlayCircle, Sparkles } from "lucide-react";

const STORAGE_KEY = "admin.tutorials.completed.v1";

function loadCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveCompleted(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export default function AdminTutorials() {
  const [active, setActive] = useState<Tutorial | null>(null);
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>(() => loadCompleted());

  useEffect(() => {
    document.title = "Tutoriais · GoDrive";
  }, []);

  const handleComplete = (id: string) => {
    setCompleted((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveCompleted(next);
      return next;
    });
  };

  const resetProgress = () => {
    setCompleted([]);
    saveCompleted([]);
  };

  const stats = useMemo(() => {
    const total = adminTutorials.length;
    const done = adminTutorials.filter((t) => completed.includes(t.id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pct };
  }, [completed]);

  const startTutorial = (t: Tutorial) => {
    setActive(t);
    setOpen(true);
  };

  const suggested = adminTutorials.find((t) => !completed.includes(t.id)) ?? adminTutorials[0];

  return (
    <div className="admin-shell">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-7">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-9 w-1 rounded-full bg-gradient-to-b from-primary to-primary/30" />
          <div className="flex-1 min-w-0">
            <div className="admin-label flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5" />
              Central de Tutoriais
            </div>
            <h1 className="admin-h1 mt-1">Aprenda a operar a GoDrive, no seu ritmo</h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
              Tours guiados passo a passo para o dia a dia: receber clientes, registrar inspeções,
              fechar devoluções e tudo o que aparece no balcão.
            </p>
          </div>
        </header>

        {/* Progresso */}
        <section className="admin-card relative overflow-hidden p-5 sm:p-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/[0.06] to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle
                    cx="18" cy="18" r="15.9155"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="18" cy="18" r="15.9155"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeDasharray={`${stats.pct}, 100`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-foreground">
                  {stats.pct}%
                </div>
              </div>
              <div>
                <div className="admin-label">Seu progresso</div>
                <div className="text-[15px] font-semibold text-foreground mt-0.5">
                  {stats.done} de {stats.total} tutoriais concluídos
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {stats.done === stats.total
                    ? "Você dominou todos os fluxos. Excelente!"
                    : "Continue de onde parou — leva poucos minutos cada um."}
                </div>
              </div>
            </div>

            <div className="sm:ml-auto flex items-center gap-2">
              <button
                onClick={() => startTutorial(suggested)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {stats.done === 0 ? "Começar do início" : "Continuar tutorial"}
              </button>
              {stats.done > 0 && (
                <button
                  onClick={resetProgress}
                  className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors px-2 h-10"
                >
                  Zerar progresso
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <div className="admin-section-title mb-3">Todos os tutoriais</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {adminTutorials.map((t) => {
              const done = completed.includes(t.id);
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => startTutorial(t)}
                  className="group relative text-left admin-card p-4 sm:p-4.5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.25)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {done && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-primary/90">
                      <CheckCircle2 className="h-3 w-3" />
                      Concluído
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border transition-colors ${
                      done
                        ? "bg-primary/15 border-primary/30"
                        : "bg-primary/[0.06] border-primary/15 group-hover:bg-primary/10 group-hover:border-primary/25"
                    }`}>
                      <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold tracking-[0.2em] text-primary/75 uppercase">
                        {t.category}
                      </div>
                      <h3 className="text-[14px] font-semibold text-foreground leading-tight mt-0.5 line-clamp-2">
                        {t.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                    {t.summary}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {t.duration} min
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        {t.steps.length} passos
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary opacity-80 group-hover:opacity-100">
                      <PlayCircle className="h-3.5 w-3.5" />
                      {done ? "Rever" : "Iniciar"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <TutorialPlayer
        tutorial={active}
        open={open}
        onClose={() => setOpen(false)}
        onComplete={handleComplete}
      />
    </div>
  );
}
