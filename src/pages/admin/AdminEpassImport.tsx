import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { EpassDropzone } from "@/components/admin/epass/EpassDropzone";
import { EpassPreview } from "@/components/admin/epass/EpassPreview";
import { mergeEpassResults, type EpassParseResult } from "@/lib/epass/csvParser";
import { extractEpassFromFile } from "@/lib/epass/smartExtract";
import { assignTolls, applyEpassImport, precheckEpassDuplicates, type AssignedToll } from "@/lib/epass/assignEngine";

export default function AdminEpassImport() {
  const navigate = useNavigate();
  const analysisSeq = useRef(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<EpassParseResult | null>(null);
  const [assigned, setAssigned] = useState<AssignedToll[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicateHashes, setDuplicateHashes] = useState<Set<string>>(new Set());
  const [checkingDupes, setCheckingDupes] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Sincronizar E-Pass · Sua Marca";
    return () => { document.title = prev; };
  }, []);

  const analyzeFiles = async (targetFiles: File[]) => {
    if (targetFiles.length === 0) return;
    const runId = ++analysisSeq.current;
    setParsing(true);
    setAssigning(false);
    try {
      const results: EpassParseResult[] = await Promise.all(targetFiles.map((f) => extractEpassFromFile(f)));
      if (runId !== analysisSeq.current) return;
      const merged = mergeEpassResults(results);
      setParsed(merged);
      setAssigned(makeInstantPreviewRows(merged));
      setStep(2);
      setParsing(false);

      setAssigning(true);
      const matched = await assignTolls(merged.tolls);
      if (runId !== analysisSeq.current) return;
      setParsed(merged);
      setAssigned(matched);
    } catch (e: any) {
      if (runId !== analysisSeq.current) return;
      toast({ title: "Erro ao analisar arquivo", description: e?.message || "Falha", variant: "destructive" });
    } finally {
      if (runId === analysisSeq.current) {
        setParsing(false);
        setAssigning(false);
      }
    }
  };

  const handleAnalyze = async () => {
    await analyzeFiles(files);
  };

  const handleFiles = (arr: File[]) => {
    const next = [...files, ...arr];
    setFiles(next);
    void analyzeFiles(next);
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
          <h1 className="text-2xl font-semibold tracking-tight">Sincronizar E-Pass</h1>
          <p className="text-sm text-muted-foreground">
            Aceita qualquer formato: CSV, Excel, PDF, TXT e até fotos do extrato.
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
            <h2 className="text-sm font-semibold mb-3">1. Selecione os arquivos do portal E-Pass (qualquer formato)</h2>
            <EpassDropzone files={files} onFiles={handleFiles} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} disabled={parsing} />
            <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
              O numero do transponder no arquivo e cruzado com o campo
              <span className="font-medium text-foreground"> E-Pass</span> de cada veiculo da frota.
              Veiculos sem transponder cadastrado caem em "Sem veiculo".
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={files.length === 0 || parsing} className="gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsing ? "Analisando..." : parsed ? "Analisar novamente" : "Analisar e atribuir"}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && parsed && (
        <div className="space-y-4">
          {assigning && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Resumo carregado.</span>{" "}
                Agora o sistema está só cruzando os pedágios com frota e reservas em segundo plano.
              </div>
            </div>
          )}
          {parsed.errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-700 dark:text-amber-400">
                {parsed.errors.length} linhas ignoradas no parse.
              </div>
            </div>
          )}
          <EpassPreview
            assigned={assigned}
            hints={parsed.transponder_hints}
            onRemapped={async () => {
              if (!parsed) return;
              const rematched = await assignTolls(parsed.tolls);
              setAssigned(rematched);
            }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-3 -mx-4 lg:-mx-6 px-4 lg:px-6 z-10">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{assigned.length}</span> pedagios ·{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{matched}</span> atribuidos a reservas ·{" "}
              <span className="font-semibold text-foreground tabular-nums">${total.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { analysisSeq.current += 1; setAssigning(false); setStep(1); setParsed(null); setAssigned([]); }} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={async () => {
                  if (assigning) return;
                  setCheckingDupes(true);
                  try {
                    const dupes = await precheckEpassDuplicates(assigned);
                    setDuplicateHashes(dupes);
                  } finally {
                    setCheckingDupes(false);
                    setConfirmOpen(true);
                  }
                }}
                size="sm"
                className="gap-2"
                disabled={checkingDupes || assigning}
              >
                {checkingDupes || assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {assigning ? "Finalizando..." : "Revisar e importar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(v) => !applying && setConfirmOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar sincronização E-Pass</DialogTitle>
            <DialogDescription>
              Revise abaixo o que será aplicado. Nada é gravado até você confirmar.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const novos = assigned.filter((t) => !duplicateHashes.has(t.dedupe_hash));
            const novosMatched = novos.filter((t) => t.status === "matched");
            const novosNoBooking = novos.filter((t) => t.status === "no_booking");
            const novosNoVehicle = novos.filter((t) => t.status === "no_vehicle");
            const novosValor = novos.reduce((s, t) => s + t.amount, 0);
            const cobravel = novosMatched.reduce((s, t) => s + t.amount, 0);
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border/60 divide-y">
                  <Row label="Pedágios lidos no arquivo" value={assigned.length} />
                  <Row label="Já importados antes (serão ignorados)" value={duplicateHashes.size} muted />
                  <Row label="Novos a gravar" value={novos.length} highlight />
                </div>
                <div className="rounded-lg border border-border/60 divide-y">
                  <Row label="Atrelados a uma reserva (cobráveis)" value={novosMatched.length} positive />
                  <Row label="Sem reserva ativa no horário" value={novosNoBooking.length} warn />
                  <Row label="Sem veículo cadastrado (transponder novo)" value={novosNoVehicle.length} warn />
                </div>
                <div className="rounded-lg border border-border/60 divide-y">
                  <Row label="Valor total novo" value={`$${novosValor.toFixed(2)}`} />
                  <Row label="Valor cobrável de clientes" value={`$${cobravel.toFixed(2)}`} highlight />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Nenhum registro existente é alterado ou removido. Duplicatas são detectadas por
                  transponder + data/hora + local + valor.
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying}>Cancelar</Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar e gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function makeInstantPreviewRows(parsed: EpassParseResult): AssignedToll[] {
  return parsed.tolls.map((t) => ({
    ...t,
    vehicle_id: null,
    vehicle_name: null,
    vehicle_plate: null,
    booking_id: null,
    booking_number: null,
    customer_id: null,
    customer_name: null,
    status: "no_vehicle" as const,
  }));
}

function Row({ label, value, muted, highlight, positive, warn }: { label: string; value: string | number; muted?: boolean; highlight?: boolean; positive?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground"}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${
        highlight ? "text-primary" : positive ? "text-emerald-600 dark:text-emerald-400" : warn ? "text-amber-600 dark:text-amber-400" : ""
      }`}>{value}</span>
    </div>
  );
}
