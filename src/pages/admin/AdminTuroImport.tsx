import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TuroDropzone } from "@/components/admin/turo/TuroDropzone";
import { TuroDiffTable } from "@/components/admin/turo/TuroDiffTable";
import { TuroChangesPreview } from "@/components/admin/turo/TuroChangesPreview";

import { parseTuroCsv, mergeParseResults, type ParseResult, type TuroRow } from "@/lib/turo/csvParser";
import {
  classifyRow,
  summarize,
  type Classification,
  type BookingSnapshot,
} from "@/lib/turo/diffEngine";
import {
  applyClassifications,
  loadExistingTuroBookings,
  loadVehicleMapping,
} from "@/lib/turo/applyChanges";

type Step = 1 | 2 | 3;

export default function AdminTuroImport() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [parseErrors, setParseErrors] = useState<{ line: number; reason: string }[]>([]);
  const [vehicleMapping, setVehicleMapping] = useState<Map<string, string>>(new Map());
  const [existing, setExisting] = useState<Map<string, BookingSnapshot>>(new Map());
  const [rawRows, setRawRows] = useState<TuroRow[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Sincronizar Turo · GoDrive";
    return () => { document.title = prev; };
  }, []);


  const handleAddFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const reclassify = useCallback((rows: TuroRow[], mapping: Map<string, string>, existingMap: Map<string, BookingSnapshot>) => {
    return rows.map((row) => classifyRow(row, { vehicleMapping: mapping, existingByTuroId: existingMap }));
  }, []);

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setParsing(true);
    try {
      const results: ParseResult[] = [];
      for (const f of files) results.push(await parseTuroCsv(f));
      const merged = mergeParseResults(results);

      const [mapping, existingMap] = await Promise.all([
        loadVehicleMapping(),
        loadExistingTuroBookings(),
      ]);

      const classified = reclassify(merged.rows, mapping, existingMap);

      setRawRows(merged.rows);
      setVehicleMapping(mapping);
      setExisting(existingMap);
      setClassifications(classified);
      setParseErrors(merged.errors);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Erro ao processar CSV", description: e?.message || "Falha no parse", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const summary = useMemo(() => summarize(classifications), [classifications]);

  const handleToggleSelected = (idx: number, value: boolean) => {
    setClassifications((prev) => prev.map((c, i) => i === idx ? { ...c, selected: value } : c));
  };

  const handleToggleField = (idx: number, field: keyof BookingSnapshot, value: boolean) => {
    setClassifications((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const next = new Set(c.selectedFields);
      if (value) next.add(field); else next.delete(field);
      return { ...c, selectedFields: next, selected: next.size > 0 };
    }));
  };

  const handleBulkSelectFields = (indices: number[], selectAll: boolean) => {
    const indexSet = new Set(indices);
    setClassifications((prev) => prev.map((c, i) => {
      if (!indexSet.has(i) || c.kind !== "enrich") return c;
      const next = selectAll
        ? new Set<keyof BookingSnapshot>(c.diffs.map((d) => d.field))
        : new Set<keyof BookingSnapshot>();
      return { ...c, selectedFields: next, selected: next.size > 0 };
    }));
  };

  const handleVehicleMapped = (turoName: string, vehicleId: string) => {
    const nextMapping = new Map(vehicleMapping);
    nextMapping.set(turoName.trim(), vehicleId);
    setVehicleMapping(nextMapping);
    // Reclassifica para mover de "unmapped" para "new"
    setClassifications(reclassify(rawRows, nextMapping, existing));
  };

  const selectedSummary = useMemo(() => {
    const sel = classifications.filter((c) => c.selected);
    const ins = sel.filter((c) => c.kind === "new").length;
    const upd = sel.filter((c) => c.kind === "enrich").length;
    const can = sel.filter((c) => c.kind === "cancelled_csv").length;
    return { total: sel.length, ins, upd, can };
  }, [classifications]);

  // Breakdown por campo: quantos enriches tocam cada campo e quantos foram auto-marcados
  const fieldBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; total: number; auto: number; manual: number }>();
    for (const c of classifications) {
      if (c.kind !== "enrich") continue;
      for (const d of c.diffs) {
        const key = String(d.field);
        const entry = map.get(key) || { label: d.label, total: 0, auto: 0, manual: 0 };
        entry.total++;
        if (d.autoSelected) entry.auto++;
        else entry.manual++;
        map.set(key, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [classifications]);

  // Quantos enriches só têm campos NÃO auto-marcados (aparecem mas não sincronizam sozinhos)
  const enrichManualOnly = useMemo(
    () => classifications.filter((c) => c.kind === "enrich" && c.diffs.every((d) => !d.autoSelected)).length,
    [classifications]
  );
  const enrichAutoCount = summary.enrichCount - enrichManualOnly;

  const handleApply = async () => {
    setApplying(true);
    try {
      const selected = classifications.filter((c) => c.selected);
      const report = await applyClassifications(selected);
      const parts = [
        `${report.insertedIds.length} criadas`,
        `${report.updatedIds.length} atualizadas`,
      ];
      if (report.skipped.length) parts.push(`${report.skipped.length} ignoradas (já existiam)`);
      if (report.failures.length) parts.push(`${report.failures.length} falhas`);
      toast({
        title: report.failures.length ? "Importação concluída com avisos" : "Importação concluída",
        description: parts.join(" · "),
        variant: report.failures.length ? "destructive" : "default",
      });
      if (report.failures.length > 0) console.warn("[turo-import] failures", report.failures);
      if (report.skipped.length > 0) console.info("[turo-import] skipped (dedupe)", report.skipped);
      setConfirmOpen(false);
      navigate("/admin/bookings");
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e?.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/bookings")}
          className="h-9 w-9 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar reservas da Turo</h1>
          <p className="text-sm text-muted-foreground">
            Compare os CSVs da Turo com o sistema e importe somente o que estiver faltando.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {[
          { n: 1, label: "Upload" },
          { n: 2, label: "Revisar" },
          { n: 3, label: "Confirmar" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold tabular-nums ${
              step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className={step >= s.n ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* STEP 1. Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-card border border-border/60 rounded-xl p-4 lg:p-6">
            <h2 className="text-sm font-semibold mb-3">1. Selecione os arquivos CSV exportados da Turo</h2>
            <TuroDropzone files={files} onFiles={handleAddFiles} onRemove={handleRemoveFile} disabled={parsing} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={files.length === 0 || parsing} className="gap-2">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsing ? "Analisando..." : "Analisar e comparar"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2. Revisar */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Resumo do que foi lido */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                Lemos <span className="font-semibold text-foreground tabular-nums">{summary.total}</span> linhas
                {" "}de <span className="font-semibold text-foreground tabular-nums">{files.length}</span> {files.length === 1 ? "arquivo" : "arquivos"} CSV
                {files.length > 0 && (
                  <span className="opacity-70"> ({files.map((f) => f.name).join(", ")})</span>
                )}.
                {" "}Cada linha foi comparada com o banco usando o <span className="font-medium text-foreground">ID da reserva Turo</span>.
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Kpi label="Total CSV" value={summary.total} tone="default" hint="Linhas válidas lidas dos arquivos enviados." />
            <Kpi label="Novas" value={summary.newCount} tone="success" hint="Reservas que ainda não existem no GoDrive. serão criadas." />
            <Kpi label="Enriquecer" value={summary.enrichCount} tone="warning" hint="Já existem no GoDrive, mas o CSV traz dados novos (ex: hora real de devolução, valor final, status que avançou para 'concluída')." />
            <Kpi label="Em dia" value={summary.identicalCount} tone="muted" hint="Reservas idênticas. não precisam de nada." />
            <Kpi label="Canceladas" value={summary.cancelledCount} tone="danger" hint="CSV marca como cancelada. Aplicar só atualiza status; não cria." />
            <Kpi label="Sem veículo" value={summary.unmappedCount} tone="orange" hint="O modelo do CSV ainda não foi vinculado a um carro da frota GoDrive." />
          </div>

          {/* Explicação do que é 'Enriquecer' e por que tem pré-selecionadas */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed">
            <div className="font-semibold text-foreground mb-1">Como funciona a pré-seleção</div>
            <div className="text-muted-foreground">
              Das <span className="tabular-nums font-medium text-foreground">{summary.enrichCount}</span> linhas em "Enriquecer", <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{enrichAutoCount}</span> têm pelo menos um campo seguro auto-marcado e <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">{enrichManualOnly}</span> estão só com campos "protegidos" (ex: nome do cliente já preenchido, status que regrediria). essas <span className="font-medium text-foreground">só sincronizam se você marcar manualmente</span>. Nada é sobrescrito sem seu opt-in.
            </div>
          </div>

          {/* Breakdown por campo. explica QUAIS campos estão divergindo */}
          {fieldBreakdown.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="text-sm font-semibold mb-1">Onde estão as divergências</div>
              <div className="text-xs text-muted-foreground mb-3">
                Cada barra mostra em quantas reservas aquele campo difere entre o CSV e o GoDrive. "Auto" = será aplicado se você confirmar. "Manual" = só com seu opt-in.
              </div>
              <div className="space-y-1.5">
                {fieldBreakdown.map((f) => {
                  const max = fieldBreakdown[0].total || 1;
                  const pct = (f.total / max) * 100;
                  const autoPct = (f.auto / f.total) * 100;
                  return (
                    <div key={f.label} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 text-xs">
                      <div className="text-foreground truncate" title={f.label}>{f.label}</div>
                      <div className="relative h-5 rounded bg-muted/50 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-amber-500/30" style={{ width: `${pct}%` }} />
                        <div className="absolute inset-y-0 left-0 bg-emerald-500/60" style={{ width: `${(pct * autoPct) / 100}%` }} />
                      </div>
                      <div className="tabular-nums text-muted-foreground whitespace-nowrap">
                        <span className="font-semibold text-foreground">{f.total}</span>
                        <span className="opacity-60"> · {f.auto} auto · {f.manual} manual</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-700 dark:text-amber-400">{parseErrors.length} linhas com erro foram ignoradas</div>
                <div className="text-amber-700/80 dark:text-amber-400/80 mt-1">
                  {parseErrors.slice(0, 3).map((e) => `linha ${e.line}: ${e.reason}`).join(" · ")}
                  {parseErrors.length > 3 && ` · e mais ${parseErrors.length - 3}`}
                </div>
              </div>
            </div>
          )}

          {summary.unmappedCount > 0 && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-orange-700 dark:text-orange-400">
                <span className="font-medium">{summary.unmappedCount} reservas</span> aguardando mapeamento de veículo. Expanda cada linha laranja e escolha o veículo correspondente da frota.
              </div>
            </div>
          )}

          <TuroChangesPreview classifications={classifications} />

          <TuroDiffTable
            classifications={classifications}
            onToggleSelected={handleToggleSelected}
            onToggleField={handleToggleField}
            onBulkSelectFields={handleBulkSelectFields}
            onVehicleMapped={handleVehicleMapped}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-3 -mx-4 lg:-mx-6 px-4 lg:px-6 z-10">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{selectedSummary.total}</span> selecionadas
              {selectedSummary.total > 0 && (
                <span className="ml-2 opacity-70">
                  ({selectedSummary.ins} novas · {selectedSummary.upd} atualizações{selectedSummary.can ? ` · ${selectedSummary.can} canceladas` : ""})
                </span>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep(1)} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={selectedSummary.total === 0}
                size="sm"
                className="gap-2"
              >
                Aplicar {selectedSummary.total} {selectedSummary.total === 1 ? "mudança" : "mudanças"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
      <Dialog open={confirmOpen} onOpenChange={(v) => !applying && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importação</DialogTitle>
            <DialogDescription>
              Esta ação vai modificar o banco de dados. Revise o resumo antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <SummaryLine label="Novas reservas a criar" value={selectedSummary.ins} tone="success" />
            <SummaryLine label="Reservas a enriquecer" value={selectedSummary.upd} tone="warning" />
            {selectedSummary.can > 0 && <SummaryLine label="Cancelamentos a aplicar" value={selectedSummary.can} tone="danger" />}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex gap-2 items-start">
            <FileSpreadsheet className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Apenas os campos marcados nas reservas a enriquecer serão alterados. Tudo o que você não marcou permanece intocado.
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying}>Cancelar</Button>
            <Button onClick={handleApply} disabled={applying} className="gap-2">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {applying ? "Aplicando..." : "Confirmar e importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: number; tone: "default" | "success" | "warning" | "muted" | "danger" | "orange"; hint?: string }) {
  const toneClass = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    muted:   "text-muted-foreground",
    danger:  "text-red-600 dark:text-red-400",
    orange:  "text-orange-600 dark:text-orange-400",
  }[tone];
  return (
    <div className="bg-card rounded-lg border border-border/60 p-3" title={hint}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/70 mt-1 leading-snug line-clamp-2">{hint}</div>}
    </div>
  );
}

function SummaryLine({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const dotClass = { success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" }[tone];
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span>{label}</span>
      </div>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
