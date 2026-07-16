import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPersonName } from "@/lib/formatName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AssignedToll } from "@/lib/epass/assignEngine";
import type { TransponderHint } from "@/lib/epass/csvParser";

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/New_York",
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

type FleetVehicle = {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  license_plate: string | null;
  e_pass_transponder: string | null;
};

function normalizePlate(s?: string | null) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Sugestao de veiculo a partir da pista extraida do arquivo (placa, modelo,
// cor, ano). Placa exata ganha; senao pontua match de tokens.
function suggestVehicle(hint: TransponderHint | undefined, fleet: FleetVehicle[]): { id: string; reason: string } | null {
  if (!hint) return null;
  const plate = normalizePlate(hint.plate);
  if (plate) {
    const byPlate = fleet.find((v) => normalizePlate(v.license_plate) === plate);
    if (byPlate) return { id: byPlate.id, reason: `placa ${hint.plate}` };
  }
  const desc = [hint.vehicle, hint.color, hint.year].filter(Boolean).join(" ").toLowerCase();
  if (!desc) return null;
  const tokens = Array.from(new Set(desc.split(/[^a-z0-9]+/i).filter((t) => t.length >= 3)));
  if (tokens.length === 0) return null;
  let best: { id: string; score: number; label: string } | null = null;
  for (const v of fleet) {
    const label = [v.brand, v.model, v.name, v.color, v.year, v.license_plate]
      .filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    for (const t of tokens) if (label.includes(t)) score++;
    if (hint.year && label.includes(hint.year)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { id: v.id, score, label };
  }
  if (best && best.score >= 2) return { id: best.id, reason: "modelo/cor/ano" };
  return null;
}

export function EpassPreview({
  assigned,
  hints,
  onRemapped,
}: {
  assigned: AssignedToll[];
  hints?: Record<string, TransponderHint>;
  onRemapped?: () => void | Promise<void>;
}) {
  const matched = useMemo(() => assigned.filter((t) => t.status === "matched"), [assigned]);
  const noBooking = useMemo(() => assigned.filter((t) => t.status === "no_booking"), [assigned]);
  const noVehicle = useMemo(() => assigned.filter((t) => t.status === "no_vehicle"), [assigned]);
  const total = useMemo(() => assigned.reduce((s, t) => s + t.amount, 0), [assigned]);
  const totalMatched = useMemo(() => matched.reduce((s, t) => s + t.amount, 0), [matched]);

  const transpondersFaltando = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const t of noVehicle) {
      const e = map.get(t.transponder_number) || { count: 0, amount: 0 };
      e.count++; e.amount += t.amount;
      map.set(t.transponder_number, e);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [noVehicle]);

  const [tab, setTab] = useState("matched");
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // transponder -> vehicle_id
  const [suggestions, setSuggestions] = useState<Record<string, { id: string; reason: string }>>({});
  const [saving, setSaving] = useState(false);

  // Carrega frota inteira pra dropdown (uma vez).
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id,name,brand,model,year,color,license_plate,e_pass_transponder")
        .order("model", { ascending: true });
      if (alive) setFleet((data || []) as FleetVehicle[]);
    })();
    return () => { alive = false; };
  }, []);

  // Ao ter frota + pistas, calcula sugestoes e pre-preenche o mapeamento.
  useEffect(() => {
    if (fleet.length === 0 || !hints) return;
    const nextSug: Record<string, { id: string; reason: string }> = {};
    const preselect: Record<string, string> = {};
    const usedByFleet = new Set(
      fleet.filter((v) => v.e_pass_transponder).map((v) => v.id),
    );
    const claimed = new Set<string>();
    for (const [tr] of transpondersFaltando) {
      const s = suggestVehicle(hints[tr], fleet);
      if (!s) continue;
      if (usedByFleet.has(s.id) || claimed.has(s.id)) continue;
      nextSug[tr] = s;
      preselect[tr] = s.id;
      claimed.add(s.id);
    }
    setSuggestions(nextSug);
    setMapping((prev) => ({ ...preselect, ...prev }));
  }, [fleet, hints, transpondersFaltando]);

  const usedVehicleIds = useMemo(() => {
    const used = new Set<string>();
    for (const v of fleet) if (v.e_pass_transponder) used.add(v.id);
    for (const id of Object.values(mapping)) if (id) used.add(id);
    return used;
  }, [fleet, mapping]);

  const pendingCount = Object.values(mapping).filter(Boolean).length;
  const suggestedCount = Object.keys(suggestions).length;

  const handleSave = async () => {
    const entries = Object.entries(mapping).filter(([, v]) => !!v);
    if (entries.length === 0) {
      toast({ title: "Nada pra salvar", description: "Selecione ao menos um veículo." });
      return;
    }
    setSaving(true);
    try {
      // 1 update por transponder (poucos por arquivo — instantâneo).
      for (const [transponder, vehicleId] of entries) {
        const { error } = await supabase
          .from("vehicles")
          .update({ e_pass_transponder: transponder })
          .eq("id", vehicleId);
        if (error) throw error;
      }
      toast({
        title: "Mapeamento salvo",
        description: `${entries.length} transponder(s) atrelado(s) à frota. Reatribuindo pedágios…`,
      });
      setMapping({});
      await onRemapped?.();
    } catch (e: any) {
      toast({ title: "Erro ao salvar mapeamento", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Total pedagios" value={assigned.length} />
        <Kpi label="Atribuidos" value={`${matched.length}`} hint={fmtUsd(totalMatched)} tone="success" />
        <Kpi label="Sem reserva" value={noBooking.length} tone="warning" />
        <Kpi label="Sem veiculo" value={noVehicle.length} tone="danger" />
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Valor total importado</div>
        <div className="text-lg font-semibold tabular-nums">{fmtUsd(total)}</div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="matched">Atribuidos ({matched.length})</TabsTrigger>
          <TabsTrigger value="no_booking">Sem reserva ({noBooking.length})</TabsTrigger>
          <TabsTrigger value="no_vehicle">Sem veiculo ({noVehicle.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="mt-3">
          <TollTable rows={matched} showBooking showCustomer />
        </TabsContent>
        <TabsContent value="no_booking" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">
            Pedagios cujo veiculo foi identificado, mas o horario nao caiu dentro de nenhuma reserva ativa
            (provavelmente uso interno, movimentacao ou manutencao).
          </p>
          <TollTable rows={noBooking} />
        </TabsContent>
        <TabsContent value="no_vehicle" className="mt-3 space-y-3">
          {transpondersFaltando.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  Vincule cada transponder ao veículo correto
                  {suggestedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      {suggestedCount} pré-atrelado(s)
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Quando o extrato traz placa, modelo, cor ou ano, o sistema já sugere o veículo da
                  frota. você só confere e aprova. Se vier apenas o número do transponder, escolha
                  manualmente. Salvando, o vínculo grava no cadastro do veículo (campo "E-Pass") e
                  <strong> reatribui os pedágios automaticamente</strong>, inclusive em futuras
                  importações.
                </p>
              </div>

              <div className="space-y-2">
                {transpondersFaltando.map(([transponder, info]) => {
                  const selected = mapping[transponder] || "";
                  const hint = hints?.[transponder];
                  const sug = suggestions[transponder];
                  const hintChips = [hint?.plate, hint?.vehicle, hint?.color, hint?.year]
                    .filter(Boolean) as string[];
                  return (
                    <div
                      key={transponder}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-border/60 bg-background/60 p-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{transponder}</span>
                          {sug && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              <Sparkles className="h-2.5 w-2.5" />
                              sugerido via {sug.reason}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                          {info.count} pedágios · {fmtUsd(info.amount)}
                        </div>
                        {hintChips.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {hintChips.map((c, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="sm:w-72">
                        <Select
                          value={selected}
                          onValueChange={(v) =>
                            setMapping((p) => ({ ...p, [transponder]: v }))
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Selecionar veículo da frota..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {fleet.length === 0 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                Carregando frota…
                              </div>
                            )}
                            {fleet.map((v) => {
                              const label = [v.model || v.name || "Veículo", v.year, v.license_plate]
                                .filter(Boolean)
                                .join(" · ");
                              const taken = usedVehicleIds.has(v.id) && selected !== v.id;
                              const isSuggested = sug?.id === v.id;
                              return (
                                <SelectItem key={v.id} value={v.id} disabled={taken}>
                                  <span className="flex items-center gap-2">
                                    <span>{label}</span>
                                    {isSuggested && (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                        (sugerido)
                                      </span>
                                    )}
                                    {v.e_pass_transponder && (
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        (já: {v.e_pass_transponder})
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-muted-foreground">
                  {pendingCount > 0
                    ? `${pendingCount} mapeamento(s) prontos pra salvar${suggestedCount > 0 ? ` (${suggestedCount} pré-atrelados pelo sistema)` : ""}`
                    : "Selecione um veículo pra cada transponder que quiser atrelar"}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || pendingCount === 0}
                  size="sm"
                  className="gap-2"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {suggestedCount > 0 && pendingCount === suggestedCount ? "Aprovar e salvar" : "Salvar e reatribuir"}
                </Button>
              </div>

            </div>
          )}
          <TollTable rows={noVehicle} hideVehicle />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-red-600 dark:text-red-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

function TollTable({
  rows, showBooking, showCustomer, hideVehicle,
}: {
  rows: AssignedToll[];
  showBooking?: boolean;
  showCustomer?: boolean;
  hideVehicle?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-6">Nenhum pedagio nesta categoria.</div>;
  }
  return (
    <div className="rounded-xl border border-border/60 overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/40 backdrop-blur">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Data/Hora (NY)</th>
            <th className="px-3 py-2 font-medium">Transponder</th>
            {!hideVehicle && <th className="px-3 py-2 font-medium">Veiculo</th>}
            {showBooking && <th className="px-3 py-2 font-medium">Reserva</th>}
            {showCustomer && <th className="px-3 py-2 font-medium">Cliente</th>}
            <th className="px-3 py-2 font-medium">Local</th>
            <th className="px-3 py-2 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDateTime(r.toll_datetime)}</td>
              <td className="px-3 py-1.5 font-mono text-[11px]">{r.transponder_number}</td>
              {!hideVehicle && (
                <td className="px-3 py-1.5">
                  <div>{r.vehicle_name || ""}</div>
                  {r.vehicle_plate && <div className="text-[10px] text-muted-foreground">{r.vehicle_plate}</div>}
                </td>
              )}
              {showBooking && <td className="px-3 py-1.5 font-mono text-[11px]">{r.booking_number || ""}</td>}
              {showCustomer && <td className="px-3 py-1.5">{r.customer_name ? formatPersonName(r.customer_name) : ""}</td>}
              <td className="px-3 py-1.5 text-muted-foreground">{r.location}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtUsd(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
