import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  DollarSign,
  Plus,
  Trash2,
  Save,
  CalendarRange,
  Sparkles,
  TrendingDown,
  Sun,
  Loader2,
} from "lucide-react";
import {
  type PriceSeason,
  type PriceOverride,
  type PricingRules,
  resolvedPriceForDate,
} from "@/lib/pricing";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  vehicleId: string;
  basePrice: number;
  onBasePriceSaved?: (next: number) => void;
};

const inputCls =
  "h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all";

const labelCls =
  "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

export default function PricingPanel({ vehicleId, basePrice, onBasePriceSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Base
  const [base, setBase] = useState<number>(basePrice || 0);

  // Seasons
  const [seasons, setSeasons] = useState<PriceSeason[]>([]);
  const [newSeason, setNewSeason] = useState({
    name: "",
    start_date: "",
    end_date: "",
    price_usd: "",
    priority: 0,
  });

  // Overrides + multi-select calendar
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [selectedDays, setSelectedDays] = useState<Date[] | undefined>(undefined);
  const [overridePrice, setOverridePrice] = useState<string>("");
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(new Date()));

  // Rules
  const [rules, setRules] = useState<PricingRules>({
    vehicle_id: vehicleId,
    weekend_multiplier: 1.0,
    weekly_discount_pct: 0,
    monthly_discount_pct: 0,
    min_nights: 1,
    weekend_days: [5, 6],
  });

  // ---------------- Load ----------------
  const load = async () => {
    setLoading(true);
    const [s, o, r] = await Promise.all([
      (supabase as any)
        .from("vehicle_price_seasons")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("priority", { ascending: false })
        .order("start_date", { ascending: true }),
      (supabase as any)
        .from("vehicle_price_overrides")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("date", { ascending: true }),
      (supabase as any)
        .from("vehicle_pricing_rules")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle(),
    ]);
    setSeasons((s.data || []) as PriceSeason[]);
    setOverrides((o.data || []) as PriceOverride[]);
    if (r.data) setRules(r.data as PricingRules);
    setLoading(false);
  };

  useEffect(() => {
    load();
    setBase(basePrice || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  // ---------------- Base ----------------
  const saveBase = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("vehicles")
      .update({ daily_price_usd: base })
      .eq("id", vehicleId);
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Preço base salvo" });
    onBasePriceSaved?.(base);
  };

  // ---------------- Seasons ----------------
  const addSeason = async () => {
    if (!newSeason.name || !newSeason.start_date || !newSeason.end_date || !newSeason.price_usd) {
      return toast({ title: "Preencha todos os campos da temporada", variant: "destructive" });
    }
    const { error } = await (supabase as any).from("vehicle_price_seasons").insert({
      vehicle_id: vehicleId,
      name: newSeason.name,
      start_date: newSeason.start_date,
      end_date: newSeason.end_date,
      price_usd: Number(newSeason.price_usd),
      priority: Number(newSeason.priority) || 0,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNewSeason({ name: "", start_date: "", end_date: "", price_usd: "", priority: 0 });
    toast({ title: "Temporada adicionada" });
    load();
  };

  const removeSeason = async (id: string) => {
    if (!confirm("Excluir temporada?")) return;
    await (supabase as any).from("vehicle_price_seasons").delete().eq("id", id);
    load();
  };

  // ---------------- Overrides ----------------
  const applyOverrides = async () => {
    const price = Number(overridePrice);
    if (!selectedDays?.length || !price || price <= 0) {
      return toast({ title: "Selecione dias e informe um preço válido", variant: "destructive" });
    }
    const rows = selectedDays.map((d) => ({
      vehicle_id: vehicleId,
      date: format(d, "yyyy-MM-dd"),
      price_usd: price,
    }));
    const { error } = await (supabase as any)
      .from("vehicle_price_overrides")
      .upsert(rows, { onConflict: "vehicle_id,date" });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: `${rows.length} dia(s) atualizados` });
    setSelectedDays(undefined);
    setOverridePrice("");
    load();
  };

  const removeOverride = async (id: string) => {
    await (supabase as any).from("vehicle_price_overrides").delete().eq("id", id);
    load();
  };

  const clearMonthOverrides = async () => {
    if (!confirm(`Remover todos os overrides de ${format(calMonth, "MMMM yyyy", { locale: ptBR })}?`)) return;
    const ids = overrides
      .filter((o) => {
        const d = new Date(o.date + "T00:00:00");
        return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth();
      })
      .map((o) => o.id);
    if (!ids.length) return;
    await (supabase as any).from("vehicle_price_overrides").delete().in("id", ids);
    load();
  };

  // ---------------- Rules ----------------
  const saveRules = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("vehicle_pricing_rules").upsert(
      {
        vehicle_id: vehicleId,
        weekend_multiplier: rules.weekend_multiplier,
        weekly_discount_pct: rules.weekly_discount_pct,
        monthly_discount_pct: rules.monthly_discount_pct,
        min_nights: rules.min_nights,
        weekend_days: rules.weekend_days,
      },
      { onConflict: "vehicle_id" },
    );
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Regras salvas" });
  };

  // ---------------- Calendar modifiers (cor de fundo por origem do preço) ----------------
  const visibleDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) }),
    [calMonth],
  );
  const dayClassifications = useMemo(() => {
    const overrideDays: Date[] = [];
    const seasonDays: Date[] = [];
    for (const d of visibleDays) {
      const r = resolvedPriceForDate(d, base, seasons, overrides, rules);
      if (r.source === "override") overrideDays.push(d);
      else if (r.source === "season") seasonDays.push(d);
    }
    return { overrideDays, seasonDays };
  }, [visibleDays, base, seasons, overrides, rules]);

  if (loading) {
    return (
      <LoadingRowsPricing />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Diária base ── */}
      <Card className="bg-card/80 border-border/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Diária base</h3>
          <span className="text-[10px] text-muted-foreground ml-1">
            valor padrão quando nenhuma regra se aplica
          </span>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[220px]">
            <label className={labelCls}>Preço por dia (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                value={base || ""}
                onChange={(e) => setBase(Number(e.target.value))}
                className={`${inputCls} pl-7 w-full`}
              />
            </div>
          </div>
          <button
            onClick={saveBase}
            disabled={saving}
            className="h-9 px-4 gold-gradient text-primary-foreground rounded-lg text-xs font-medium uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
          >
            <Save size={12} /> Salvar
          </button>
        </div>
      </Card>

      {/* ── Temporadas ── */}
      <Card className="bg-card/80 border-border/30 p-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarRange size={16} className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Temporadas</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Alta/baixa temporada por intervalo. Quanto maior a prioridade, mais forte (vence outras temporadas no mesmo dia).
        </p>

        {/* Add row */}
        <div className="grid grid-cols-12 gap-2 mb-3 p-3 rounded-lg bg-muted/30 border border-dashed border-border/40">
          <div className="col-span-12 md:col-span-3">
            <label className={labelCls}>Nome</label>
            <input
              value={newSeason.name}
              onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
              placeholder="Alta temporada"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className={labelCls}>Início</label>
            <input
              type="date"
              value={newSeason.start_date}
              onChange={(e) => setNewSeason({ ...newSeason, start_date: e.target.value })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className={labelCls}>Fim</label>
            <input
              type="date"
              value={newSeason.end_date}
              onChange={(e) => setNewSeason({ ...newSeason, end_date: e.target.value })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className={labelCls}>Preço/dia (USD)</label>
            <input
              type="number"
              inputMode="decimal"
              value={newSeason.price_usd}
              onChange={(e) => setNewSeason({ ...newSeason, price_usd: e.target.value })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="col-span-4 md:col-span-1">
            <label className={labelCls}>Prior.</label>
            <input
              type="number"
              value={newSeason.priority}
              onChange={(e) => setNewSeason({ ...newSeason, priority: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="col-span-8 md:col-span-2 flex items-end">
            <button
              onClick={addSeason}
              className="h-9 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
        </div>

        {/* List */}
        {seasons.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-3 text-center">
            Nenhuma temporada cadastrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="text-left py-2 px-2">Nome</th>
                  <th className="text-left py-2 px-2">Início</th>
                  <th className="text-left py-2 px-2">Fim</th>
                  <th className="text-right py-2 px-2">Preço/dia</th>
                  <th className="text-center py-2 px-2">Prior.</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s.id} className="border-b border-border/10 hover:bg-muted/20">
                    <td className="py-2.5 px-2 text-foreground font-medium">{s.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground tabular-nums">
                      {format(new Date(s.start_date + "T00:00:00"), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground tabular-nums">
                      {format(new Date(s.end_date + "T00:00:00"), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground font-semibold tabular-nums">
                      ${s.price_usd.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-muted-foreground tabular-nums">{s.priority}</td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => removeSeason(s.id)}
                        className="w-7 h-7 rounded-md bg-muted/50 hover:text-destructive flex items-center justify-center text-muted-foreground"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Calendário + overrides ── */}
      <Card className="bg-card/80 border-border/30 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Preços por dia (calendário)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Selecione vários dias, informe o preço e aplique. Esses preços vencem temporadas e base.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          <div className="rounded-xl border border-border/40 bg-background/50 p-2 inline-block">
            <Calendar
              mode="multiple"
              selected={selectedDays}
              onSelect={setSelectedDays}
              month={calMonth}
              onMonthChange={setCalMonth}
              locale={ptBR}
              modifiers={{
                hasOverride: dayClassifications.overrideDays,
                hasSeason: dayClassifications.seasonDays,
              }}
              modifiersClassNames={{
                hasOverride: "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30",
                hasSeason: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold",
              }}
              className="pointer-events-auto"
            />
            <div className="flex items-center gap-3 px-2 pt-1 pb-1 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary/30 ring-1 ring-primary/40" /> Override
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" /> Temporada
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Aplicar preço aos dias selecionados
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-[220px]">
                  <label className={labelCls}>Preço por dia (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={overridePrice}
                      onChange={(e) => setOverridePrice(e.target.value)}
                      placeholder="0,00"
                      className={`${inputCls} pl-7 w-full`}
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pb-2">
                  {selectedDays?.length ?? 0} dia(s) selecionado(s)
                </div>
                <button
                  onClick={applyOverrides}
                  disabled={!selectedDays?.length || !overridePrice}
                  className="h-9 px-4 gold-gradient text-primary-foreground rounded-lg text-xs font-medium uppercase tracking-widest disabled:opacity-40"
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground">
                Overrides de {format(calMonth, "MMMM yyyy", { locale: ptBR })}
              </h4>
              <button
                onClick={clearMonthOverrides}
                className="text-[10px] text-muted-foreground hover:text-destructive uppercase tracking-wider"
              >
                Limpar mês
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto border border-border/30 rounded-lg">
              {overrides.filter((o) => {
                const d = new Date(o.date + "T00:00:00");
                return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth();
              }).length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic py-6 text-center">
                  Nenhum override neste mês.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {overrides
                      .filter((o) => {
                        const d = new Date(o.date + "T00:00:00");
                        return (
                          d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth()
                        );
                      })
                      .map((o) => (
                        <tr key={o.id} className="border-b border-border/10 hover:bg-muted/20">
                          <td className="py-2 px-3 text-foreground tabular-nums">
                            {format(new Date(o.date + "T00:00:00"), "dd 'de' MMM (EEE)", { locale: ptBR })}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-primary tabular-nums">
                            ${o.price_usd.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 w-10">
                            <button
                              onClick={() => removeOverride(o.id)}
                              className="w-6 h-6 rounded-md bg-muted/50 hover:text-destructive flex items-center justify-center text-muted-foreground"
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Regras dinâmicas ── */}
      <Card className="bg-card/80 border-border/30 p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown size={16} className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Regras dinâmicas</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Ajustes aplicados em cima do preço resolvido (override → temporada → base).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>
              <Sun size={10} className="inline mr-1" />
              Multiplicador fim de semana
            </label>
            <input
              type="number"
              step="0.01"
              value={rules.weekend_multiplier}
              onChange={(e) => setRules({ ...rules, weekend_multiplier: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Ex.: 1.25 = +25% sex/sáb</p>
          </div>
          <div>
            <label className={labelCls}>Desconto 7+ noites (%)</label>
            <input
              type="number"
              step="0.5"
              value={rules.weekly_discount_pct}
              onChange={(e) => setRules({ ...rules, weekly_discount_pct: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>Desconto 30+ noites (%)</label>
            <input
              type="number"
              step="0.5"
              value={rules.monthly_discount_pct}
              onChange={(e) => setRules({ ...rules, monthly_discount_pct: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>Mínimo de noites</label>
            <input
              type="number"
              min={1}
              value={rules.min_nights}
              onChange={(e) => setRules({ ...rules, min_nights: Number(e.target.value) })}
              className={`${inputCls} w-full`}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            Dias de fim de semana:
            {["D", "S", "T", "Q", "Q", "S", "S"].map((lbl, idx) => {
              const on = rules.weekend_days.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() =>
                    setRules({
                      ...rules,
                      weekend_days: on
                        ? rules.weekend_days.filter((d) => d !== idx)
                        : [...rules.weekend_days, idx].sort(),
                    })
                  }
                  className={`w-7 h-7 rounded-md text-[11px] font-semibold border transition-colors ${
                    on
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <button
            onClick={saveRules}
            disabled={saving}
            className="ml-auto h-9 px-4 gold-gradient text-primary-foreground rounded-lg text-xs font-medium uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50"
          >
            <Save size={12} /> Salvar regras
          </button>
        </div>
      </Card>
    </div>
  );
}
