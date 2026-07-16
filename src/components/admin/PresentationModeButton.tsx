import { useEffect, useState } from "react";
import { Play, Square, Presentation, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type State = {
  target_count: number;
  hidden_vehicle_ids: string[];
  started_at: string;
} | null;

import { SHOW_PRESENTATION_CONTROLS } from "@/lib/demo/config";

type Props = { variant?: "pill" | "icon" };

export default function PresentationModeButton({ variant = "pill" }: Props) {
  if (variant === "pill" && !SHOW_PRESENTATION_CONTROLS) return null;
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<string>("15");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<State>(null);

  const refresh = async () => {
    const { data } = await (supabase as any)
      .from("demo_presentation_state")
      .select("target_count, hidden_vehicle_ids, started_at")
      .maybeSingle();
    setState((data as unknown as State) ?? null);
  };

  useEffect(() => { void refresh(); }, []);

  const active = !!state;

  const handleStart = async () => {
    const n = parseInt(count, 10);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      toast.error("Digite um número entre 1 e 500");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("demo_start_presentation" as any, { p_count: n });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível iniciar a apresentação", { description: error.message });
      return;
    }
    const kept = (data as any)?.kept ?? n;
    toast.success(`Apresentação iniciada com ${kept} veículos`);
    setOpen(false);
    await refresh();
    // Reload the app so all cached queries refetch with the new fleet baseline
    setTimeout(() => window.location.reload(), 350);
  };

  const handleStop = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("demo_stop_presentation" as any);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível encerrar", { description: error.message });
      return;
    }
    toast.success("Frota restaurada");
    await refresh();
    setTimeout(() => window.location.reload(), 350);
  };

  const triggerLabel = active ? "Apresentação em andamento" : "Iniciar apresentação";

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={triggerLabel}
          aria-label={triggerLabel}
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors flex items-center justify-center"
        >
          <Play className="h-4 w-4" strokeWidth={1.75} style={active ? { color: "#d6bf86" } : undefined} />
          {active && (
            <span
              className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
              style={{ background: "#9a7a3a", boxShadow: "0 0 6px rgba(154,122,58,0.7)" }}
            />
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title={triggerLabel}
          aria-label={triggerLabel}
          className={`group relative inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] font-medium transition-all ${
            active
              ? "text-white border shadow-[0_8px_20px_-10px_rgba(13,29,46,0.45)]"
              : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
          style={active ? {
            background: "linear-gradient(180deg, #14283d, #0d1d2e)",
            borderColor: "rgba(154,122,58,0.45)",
          } : undefined}
        >
          <Presentation size={14} strokeWidth={1.75} style={active ? { color: "#d6bf86" } : undefined} />
          <span>{active ? `Apresentação · ${state?.target_count}` : "Iniciar apresentação"}</span>
          {active && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full" style={{ background: "#9a7a3a", boxShadow: "0 0 8px rgba(154,122,58,0.7)" }} />
          )}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Presentation size={18} />
              Modo apresentação
            </DialogTitle>
            <DialogDescription>
              Escolha o tamanho da frota simulada. O sistema monta um mix estilo Pareto: sempre inclui pelo menos um carro campeão (alto retorno), um caroço (baixo retorno) e o restante entre eles. assim a narrativa "poucos carros trazem a maior parte da receita" aparece em qualquer tamanho. Os demais são ocultados temporariamente da frota, reservas, rastreador e relatórios.
            </DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frota exibida</span>
                <span className="font-medium tabular-nums">{state?.target_count} carros</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ocultos</span>
                <span className="font-medium tabular-nums">{state?.hidden_vehicle_ids?.length ?? 0} carros</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iniciada</span>
                <span className="font-medium tabular-nums">{state ? new Date(state.started_at).toLocaleString("pt-BR") : ""}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="presentation-count">Quantos carros exibir?</Label>
              <Input
                id="presentation-count"
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="Ex: 15"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") void handleStart(); }}
              />
              <p className="text-[11px] text-muted-foreground">
                Sugestões: 10 · 15 · 20 · 30 · 50. A qualquer momento você pode encerrar e a frota original volta ao normal.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {active ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Fechar</Button>
                <Button variant="destructive" onClick={handleStop} disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Square size={14} className="mr-1.5" />}
                  Encerrar apresentação
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
                <Button onClick={handleStart} disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Play size={14} className="mr-1.5" />}
                  Iniciar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
