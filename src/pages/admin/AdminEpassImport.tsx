import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { EpassDropzone } from "@/components/admin/epass/EpassDropzone";
import { EpassPreview } from "@/components/admin/epass/EpassPreview";
import { parseEpassCsv, mergeEpassResults, type EpassParseResult } from "@/lib/epass/csvParser";
import { assignTolls, applyEpassImport, precheckEpassDuplicates, type AssignedToll } from "@/lib/epass/assignEngine";

export default function AdminEpassImport() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<EpassParseResult | null>(null);
  const [assigned, setAssigned] = useState<AssignedToll[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicateHashes, setDuplicateHashes] = useState<Set<string>>(new Set());
  const [checkingDupes, setCheckingDupes] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Sincronizar E-Pass · Zeus Rental Car";
    return () => { document.title = prev; };
  }, []);

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setParsing(true);
    try {
      const results: EpassParseResult[] = [];
      for (const f of files) results.push(await parseEpassCsv(f));
      const merged = mergeEpassResults(results);
      const matched = await assignTolls(merged.tolls);
      setParsed(merged);
      setAssigned(matched);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Erro ao analisar CSV", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    if (!parsed) return;
    setApplying(true);
    try {
      const res = await applyEpassImport(parsed, assigned);
      toast({
        title: "Importacao concluida",
        description: `${res.inserted} pedagios importados${res.skipped ? ` · ${res.skipped} ja existentes` : ""}.`,
      });
      setConfirmOpen(false);
      navigate("/admin/bookings");
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e?.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const total = assigned.reduce((s, t) => s + t.amount, 0);
  const matched = assigned.filter((t) => t.status === "matched").length;

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar pedagios E-Pass</h1>
          <p className="text-sm text-muted-foreground">
            Suba o CSV do portal E-Pass. O sistema atrela cada pedagio ao veiculo
            (pelo numero do transponder) e a reserva ativa no horario.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {[{ n: 1, label: "Upload" }, { n: 2, label: "Revisar e importar" }].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold tabular-nums ${
              step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className={step >= s.n ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-card border border-border/60 rounded-xl p-4 lg:p-6">
            <h2 className="text-sm font-semibold mb-3">1. Selecione o(s) CSV(s) exportados do portal E-Pass</h2>
            <EpassDropzone files={files} onFiles={(arr) => setFiles((p) => [...p, ...arr])} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} disabled={parsing} />
            <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              O numero do transponder no CSV (coluna "Transponder Number") e cruzado com o campo
              <span className="font-medium text-foreground"> E-Pass</span> de cada veiculo da frota.
              Veiculos sem transponder cadastrado caem em "Sem veiculo".
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={files.length === 0 || parsing} className="gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsing ? "Analisando..." : "Analisar e atribuir"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && parsed && (
        <div className="space-y-4">
          {parsed.errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-700 dark:text-amber-400">
                {parsed.errors.length} linhas ignoradas no parse.
              </div>
            </div>
          )}
          <EpassPreview assigned={assigned} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-3 -mx-4 lg:-mx-6 px-4 lg:px-6 z-10">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{assigned.length}</span> pedagios ·{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{matched}</span> atribuidos a reservas ·{" "}
              <span className="font-semibold text-foreground tabular-nums">${total.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setStep(1); setParsed(null); setAssigned([]); }} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setConfirmOpen(true)} size="sm" className="gap-2">
                Importar para o sistema <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(v) => !applying && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importacao E-Pass</DialogTitle>
            <DialogDescription>
              {assigned.length} pedagios serao registrados. Pedagios ja importados antes
              (mesmo transponder + data/hora + local + valor) sao ignorados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1 tabular-nums">
            <div>Atribuidos a reservas: <span className="font-semibold">{matched}</span></div>
            <div>Sem reserva ativa: <span className="font-semibold">{assigned.filter(t => t.status === "no_booking").length}</span></div>
            <div>Sem veiculo cadastrado: <span className="font-semibold">{assigned.filter(t => t.status === "no_vehicle").length}</span></div>
            <div className="pt-2">Valor total: <span className="font-semibold">${total.toFixed(2)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying}>Cancelar</Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar importacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
