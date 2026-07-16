import { useMemo, useState } from "react";
import { Brain, Sparkles, ArrowRight, Loader2, Tag, ShoppingCart, Check, TrendingUp, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { findBrandByName, carLogoUrl } from "@/data/carBrands";
import { optimizeFleet, countEligible, type AiScenario } from "@/lib/aiStudio/aiOptimizer";
import type { SimVehicle } from "./FleetSimulator";

/* Mesma paleta private-bank do simulador */
const NAVY = "#0d1d2e";
const NAVY_70 = "rgba(13,29,46,0.70)";
const NAVY_55 = "rgba(13,29,46,0.55)";
const NAVY_40 = "rgba(13,29,46,0.40)";
const NAVY_10 = "rgba(13,29,46,0.10)";
const NAVY_06 = "rgba(13,29,46,0.06)";
const IVORY = "#fbf7ee";
const IVORY_SOFT = "#f6f1e6";
const GOLD = "#9a7a3a";
const GOLD_SOFT = "#c8a86b";
const SELL = "#a33a3a";
const SELL_BG = "#fbecec";
const BUY = "#1f6b4c";
const BUY_BG = "#e8f1ec";

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtUSDsigned = (n: number) =>
  `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

function brandLogoUrl(v: SimVehicle["v"]): string | null {
  const raw = (v.brand || v.name?.split(" ")[0] || "").trim();
  if (!raw) return null;
  const match = findBrandByName(raw);
  if (match) return match.logoUrl;
  return carLogoUrl(raw.toLowerCase().replace(/\s+/g, "-"));
}

function Logo({ v }: { v: SimVehicle["v"] }) {
  const [err, setErr] = useState(false);
  const url = brandLogoUrl(v);
  const initials = (v.brand || v.name || "?").slice(0, 2).toUpperCase();
  if (!url || err) {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0"
        style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}`, color: NAVY_70 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0"
      style={{ border: `1px solid ${NAVY_10}` }}
    >
      <img src={url} alt="" className="w-7 h-7 object-contain" onError={() => setErr(true)} />
    </div>
  );
}

function VehicleLine({
  v, qty, side, suffix,
}: {
  v: SimVehicle;
  qty?: number;
  side: "sell" | "buy";
  suffix?: string;
}) {
  const color = side === "sell" ? SELL : BUY;
  const bg = side === "sell" ? SELL_BG : BUY_BG;
  const name = v.v.name || `${v.v.brand ?? ""} ${v.v.model ?? ""}`.trim() || "";
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
      style={{ background: bg, border: `1px solid ${color}30` }}
    >
      <Logo v={v.v} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold truncate" style={{ color: NAVY }}>
          {qty && qty > 1 ? `${qty}× ` : ""}{name}
        </div>
        <div className="text-[10.5px] tabular-nums truncate" style={{ color: NAVY_55 }}>
          Pago {fmtUSD(v.purchase)} · {v.occupancy.toFixed(0)}% uso · {fmtUSD(v.revPerDayOwned)}/dia
        </div>
      </div>
      {suffix && (
        <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export default function AiOptimizerDialog({
  perVehicle,
  open,
  onOpenChange,
  onApply,
}: {
  perVehicle: SimVehicle[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (sellIds: string[], buyIds: string[], buyQty: Record<string, number>) => void;
}) {
  const eligibleCount = useMemo(() => countEligible(perVehicle), [perVehicle]);
  const maxSell = Math.max(1, Math.min(eligibleCount - 1, 10));
  const [sellCount, setSellCount] = useState(2);
  const [scenario, setScenario] = useState<AiScenario | null>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    setScenario(null);
    // pequena pausa pra UX (mostra que "pensou")
    setTimeout(() => {
      const result = optimizeFleet(perVehicle, sellCount);
      setScenario(result);
      setLoading(false);
    }, 650);
  };

  const apply = () => {
    if (!scenario) return;
    const sellIds = scenario.sell.map(p => p.v.id);
    const buyIds = scenario.buy.map(b => b.vehicle.v.id);
    const qty: Record<string, number> = {};
    scenario.buy.forEach(b => { qty[b.vehicle.v.id] = b.qty; });
    onApply(sellIds, buyIds, qty);
    onOpenChange(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => { setScenario(null); setLoading(false); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden gap-0 border-0 max-h-[92vh] flex flex-col"
        style={{ background: IVORY }}
      >
        <DialogTitle className="sr-only">Simular com Inteligência Artificial</DialogTitle>

        {/* Header */}
        <div
          className="relative px-5 sm:px-7 pt-5 pb-4 shrink-0"
          style={{ background: NAVY }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, ${GOLD}, ${GOLD_SOFT}, transparent)` }}
          />
          <button
            onClick={close}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" style={{ color: IVORY }} />
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Brain size={13} style={{ color: "#d6bf86" }} />
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#d6bf86" }}>
              AI Studio · Otimizador
            </span>
          </div>
          <h2 className="text-[15px] sm:text-[17px] font-medium leading-snug pr-8" style={{ color: IVORY, letterSpacing: "-0.01em" }}>
            Diga quantos carros quer vender. A IA encontra a melhor combinação.
          </h2>
        </div>

        {/* Body scroll */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">

          {/* Controle */}
          <div
            className="rounded-xl p-4 sm:p-5"
            style={{ background: "#fff", border: `1px solid ${NAVY_10}`, boxShadow: "0 4px 14px -10px rgba(13,29,46,0.18)" }}
          >
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[10.5px] uppercase tracking-[0.20em] font-semibold" style={{ color: NAVY_55 }}>
                Quantos carros vender
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: NAVY_55 }}>
                {eligibleCount} carros elegíveis na frota
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="text-[56px] font-semibold tabular-nums leading-none w-[88px] text-center"
                style={{ color: NAVY, letterSpacing: "-0.03em" }}
              >
                {sellCount}
              </div>
              <div className="flex-1">
                <Slider
                  value={[sellCount]}
                  onValueChange={(v) => { setSellCount(v[0]); setScenario(null); }}
                  min={1}
                  max={maxSell}
                  step={1}
                  className="cursor-pointer"
                />
                <div className="flex justify-between mt-1.5 text-[10px] tabular-nums" style={{ color: NAVY_40 }}>
                  <span>1</span>
                  <span>{maxSell}</span>
                </div>
              </div>
            </div>

            <p className="text-[12px] mt-4 leading-[1.6]" style={{ color: NAVY_70 }}>
              A IA vai analisar todos os carros precificados com 60+ dias de histórico real,
              eliminar os {sellCount === 1 ? "1 pior" : `${sellCount} piores`} performers e testar
              <span className="font-semibold" style={{ color: NAVY }}> milhares de combinações de compra </span>
              até encontrar o cenário que maximiza a receita diária dentro do capital recuperado.
            </p>

            <button
              onClick={run}
              disabled={loading}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-semibold uppercase tracking-wider transition-all disabled:opacity-60 min-h-[48px]"
              style={{
                background: `linear-gradient(135deg, ${NAVY} 0%, #1a2d44 100%)`,
                color: IVORY,
                boxShadow: "0 8px 20px -12px rgba(13,29,46,0.5)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando combinações…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" style={{ color: GOLD_SOFT }} />
                  Simular com IA
                </>
              )}
            </button>
          </div>

          {/* Resultado */}
          {loading && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="relative mb-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: NAVY }}
                >
                  <Brain className="w-6 h-6 animate-pulse" style={{ color: GOLD_SOFT }} />
                </div>
              </div>
              <p className="text-[13px]" style={{ color: NAVY_70 }}>
                Avaliando todas as combinações possíveis de compra e venda…
              </p>
            </div>
          )}

          {scenario && !loading && (
            <>
              {/* Hero delta */}
              <div
                className="rounded-xl p-5 relative overflow-hidden"
                style={{ background: "#fff", border: `1px solid ${GOLD}40` }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, ${GOLD}, ${GOLD_SOFT}, transparent)` }}
                />
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY }}>
                    Melhor cenário encontrado
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
                  <div className="min-w-0 flex flex-col">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-2 min-h-[28px] leading-[1.25]" style={{ color: NAVY_55 }}>
                      Receita por dia
                    </div>
                    <div className="text-[20px] font-semibold tabular-nums leading-none truncate"
                         style={{ color: scenario.deltaPerDay >= 0 ? BUY : SELL, letterSpacing: "-0.02em" }}>
                      {fmtUSDsigned(scenario.deltaPerDay)}
                    </div>
                    <div className="text-[11px] tabular-nums mt-2 truncate" style={{ color: NAVY_55 }}>
                      {fmtUSD(scenario.currentRevPerDay)}/dia → {fmtUSD(scenario.projectedRevPerDay)}/dia
                    </div>
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-2 min-h-[28px] leading-[1.25]" style={{ color: NAVY_55 }}>
                      Em 12 meses
                    </div>
                    <div className="text-[20px] font-semibold tabular-nums leading-none truncate"
                         style={{ color: scenario.delta365 >= 0 ? BUY : SELL, letterSpacing: "-0.02em" }}>
                      {fmtUSDsigned(scenario.delta365)}
                    </div>
                    <div className="text-[11px] tabular-nums mt-2 truncate" style={{ color: NAVY_55 }}>
                      90 d {fmtUSDsigned(scenario.delta90)} . 6 m {fmtUSDsigned(scenario.delta180)}
                    </div>
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-2 min-h-[28px] leading-[1.25]" style={{ color: NAVY_55 }}>
                      Saldo em caixa
                    </div>
                    <div className="text-[20px] font-semibold tabular-nums leading-none truncate"
                         style={{ color: scenario.cashBalance >= 0 ? BUY : GOLD, letterSpacing: "-0.02em" }}>
                      {fmtUSDsigned(scenario.cashBalance)}
                    </div>
                    <div className="text-[11px] tabular-nums mt-2 truncate" style={{ color: NAVY_55 }}>
                      Recuperado {fmtUSD(scenario.recoveredCapital)} . investido {fmtUSD(scenario.spentCapital)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: `1px solid ${NAVY_06}` }}>
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  <span className="text-[11px] tabular-nums" style={{ color: NAVY_55 }}>
                    Eficiência do capital{" "}
                    <span className="font-semibold" style={{ color: scenario.capitalEfficiency >= 0 ? BUY : SELL }}>
                      {scenario.capitalEfficiency >= 0 ? "+" : ""}{scenario.capitalEfficiency.toFixed(0)}%
                    </span>{" "}
                    · {scenario.combinationsEvaluated.toLocaleString("pt-BR")} combinações avaliadas
                  </span>
                </div>
              </div>

              {/* Listas vender / comprar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${SELL}30` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-3.5 h-3.5" style={{ color: SELL }} />
                    <span className="text-[10.5px] uppercase tracking-[0.20em] font-semibold" style={{ color: SELL }}>
                      Vender ({scenario.sell.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {scenario.sell.map(p => (
                      <VehicleLine key={p.v.id} v={p} side="sell" />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${BUY}30` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart className="w-3.5 h-3.5" style={{ color: BUY }} />
                    <span className="text-[10.5px] uppercase tracking-[0.20em] font-semibold" style={{ color: BUY }}>
                      Comprar ({scenario.buy.reduce((s, b) => s + b.qty, 0)} un.)
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {scenario.buy.map(b => (
                      <VehicleLine key={b.vehicle.v.id} v={b.vehicle} qty={b.qty} side="buy" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Dados analisados */}
              <div className="rounded-xl p-4 sm:p-5" style={{ background: "#fff", border: `1px solid ${NAVY_10}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY }}>
                    Dados analisados
                  </span>
                </div>

                {/* Bloco 1 . Comparativo de receita */}
                <div className="mb-3 text-[9.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: NAVY_40 }}>
                  Comparativo de receita
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-lg p-3.5" style={{ background: IVORY_SOFT, border: `1px solid ${SELL}25` }}>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: SELL }}>
                      Frota atual
                    </div>
                    <div className="text-[22px] font-semibold tabular-nums leading-none" style={{ color: NAVY, letterSpacing: "-0.02em" }}>
                      {fmtUSD(scenario.currentRevPerDay)}
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: NAVY_55 }}>por dia . {scenario.avgOccupancySell.toFixed(0)}% de ocupação</div>
                  </div>
                  <div className="rounded-lg p-3.5" style={{ background: IVORY_SOFT, border: `1px solid ${BUY}25` }}>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: BUY }}>
                      Frota proposta
                    </div>
                    <div className="text-[22px] font-semibold tabular-nums leading-none" style={{ color: NAVY, letterSpacing: "-0.02em" }}>
                      {fmtUSD(scenario.projectedRevPerDay)}
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: NAVY_55 }}>por dia . {scenario.avgOccupancyBuy.toFixed(0)}% de ocupação</div>
                  </div>
                </div>

                {/* Bloco 2 . Movimento de capital */}
                <div className="mb-3 text-[9.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: NAVY_40 }}>
                  Movimento de capital
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  <div className="rounded-lg p-3.5" style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_06}` }}>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2" style={{ color: NAVY_55 }}>
                      Entra no caixa
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums leading-none" style={{ color: NAVY, letterSpacing: "-0.02em" }}>
                      {fmtUSD(scenario.recoveredCapital)}
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: NAVY_55 }}>vendendo {scenario.sell.length} carro{scenario.sell.length === 1 ? "" : "s"}</div>
                  </div>
                  <div className="rounded-lg p-3.5" style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_06}` }}>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2" style={{ color: NAVY_55 }}>
                      Sai do caixa
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums leading-none" style={{ color: NAVY, letterSpacing: "-0.02em" }}>
                      {fmtUSD(scenario.spentCapital)}
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: NAVY_55 }}>comprando {scenario.buy.reduce((s, b) => s + b.qty, 0)} unidade{scenario.buy.reduce((s, b) => s + b.qty, 0) === 1 ? "" : "s"}</div>
                  </div>
                  <div className="rounded-lg p-3.5" style={{ background: IVORY_SOFT, border: `1px solid ${GOLD}30` }}>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2" style={{ color: NAVY_55 }}>
                      Retorno do capital
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums leading-none" style={{ color: scenario.capitalEfficiency >= 0 ? BUY : SELL, letterSpacing: "-0.02em" }}>
                      {scenario.capitalEfficiency >= 0 ? "+" : ""}{scenario.capitalEfficiency.toFixed(0)}%
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: NAVY_55 }}>receita extra por dólar investido</div>
                  </div>
                </div>

                {/* Bloco 3 . Escopo */}
                <div className="mb-3 text-[9.5px] uppercase tracking-[0.18em] font-semibold" style={{ color: NAVY_40 }}>
                  Escopo da análise
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11.5px]" style={{ color: NAVY_55 }}>
                  <span><span className="font-semibold tabular-nums" style={{ color: NAVY }}>{eligibleCount}</span> carros analisados</span>
                  <span><span className="font-semibold tabular-nums" style={{ color: NAVY }}>{scenario.combinationsEvaluated.toLocaleString("pt-BR")}</span> cenários testados</span>
                  <span>histórico de <span className="font-semibold" style={{ color: NAVY }}>60+ dias</span> por carro</span>
                  <span>precisão de <span className="font-semibold tabular-nums" style={{ color: NAVY }}>$1.000</span></span>
                </div>
              </div>


              {/* Conclusão narrativa */}
              <div className="rounded-xl p-5" style={{ background: IVORY_SOFT, border: `1px solid ${GOLD}30` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
                  <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY }}>
                    Leitura da IA
                  </span>
                </div>
                <p
                  className="text-[13.5px]"
                  style={{ color: NAVY, lineHeight: 1.75, fontFamily: '"Söhne","Inter",ui-sans-serif,system-ui,sans-serif' }}
                >
                  <span className="font-semibold">Bruno,</span> vendendo os{" "}
                  <span className="font-semibold" style={{ color: SELL }}>{scenario.sell.length} carro{scenario.sell.length === 1 ? "" : "s"}</span>{" "}
                  de pior receita-por-dia da frota e reinvestindo em{" "}
                  <span className="font-semibold" style={{ color: BUY }}>
                    {scenario.buy.reduce((s, b) => s + b.qty, 0)} unidade{scenario.buy.reduce((s, b) => s + b.qty, 0) === 1 ? "" : "s"}
                  </span>{" "}
                  dos modelos acima, sua receita diária{" "}
                  <span className="font-semibold tabular-nums" style={{ color: scenario.deltaPerDay >= 0 ? BUY : SELL }}>
                    {scenario.deltaPerDay >= 0 ? "subiria" : "cairia"} {fmtUSDsigned(scenario.deltaPerDay)}
                  </span>
                  , o que projeta{" "}
                  <span className="font-semibold tabular-nums" style={{ color: scenario.delta365 >= 0 ? BUY : SELL }}>
                    {fmtUSDsigned(scenario.delta365)} em 12 meses
                  </span>
                  . O capital recuperado pela venda ({fmtUSD(scenario.recoveredCapital)}) cobriria{" "}
                  {scenario.cashBalance >= 0 ? (
                    <>a compra com{" "}<span className="font-semibold tabular-nums" style={{ color: BUY }}>{fmtUSD(scenario.cashBalance)} de folga em caixa</span></>
                  ) : (
                    <>quase toda a compra, exigindo aporte de{" "}<span className="font-semibold tabular-nums" style={{ color: GOLD }}>{fmtUSD(Math.abs(scenario.cashBalance))}</span></>
                  )}
                  . A ocupação média dos carros comprados ({scenario.avgOccupancyBuy.toFixed(0)}%) é{" "}
                  <span className="font-semibold" style={{ color: scenario.avgOccupancyBuy >= scenario.avgOccupancySell ? BUY : SELL }}>
                    {scenario.avgOccupancyBuy >= scenario.avgOccupancySell ? "maior" : "menor"}
                  </span>{" "}
                  que a dos vendidos ({scenario.avgOccupancySell.toFixed(0)}%), e o capital empregado fica{" "}
                  <span className="font-semibold tabular-nums" style={{ color: scenario.capitalEfficiency >= 0 ? BUY : SELL }}>
                    {Math.abs(scenario.capitalEfficiency).toFixed(0)}% {scenario.capitalEfficiency >= 0 ? "mais eficiente" : "menos eficiente"}
                  </span>
                  .
                </p>
                <div className="mt-4 pt-4 flex items-start gap-2.5" style={{ borderTop: `1px solid ${NAVY_10}` }}>
                  <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ background: GOLD }} />
                  <p className="text-[11.5px] leading-[1.65]" style={{ color: NAVY_55 }}>
                    <span className="font-semibold" style={{ color: GOLD }}>Como a IA escolheu:</span>{" "}
                    o algoritmo é uma busca combinatória determinística (knapsack 0/1) sobre o histórico real de receita, ocupação e custo de aquisição da sua frota. O resultado é o ótimo global dentro da granularidade de $1.000 e até 5 unidades por modelo. Resultados passados não garantem resultados futuros.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer ações */}
        {scenario && !loading && (
          <div
            className="px-5 sm:px-7 py-3 flex items-center gap-3 shrink-0"
            style={{ background: "#fff", borderTop: `1px solid ${NAVY_10}` }}
          >
            <button
              onClick={close}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wider min-h-[44px]"
              style={{ background: IVORY_SOFT, color: NAVY_70, border: `1px solid ${NAVY_10}` }}
            >
              Fechar
            </button>
            <button
              onClick={apply}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wider min-h-[44px]"
              style={{ background: NAVY, color: IVORY }}
            >
              <Check className="w-4 h-4" style={{ color: GOLD_SOFT }} />
              Aplicar este cenário ao simulador
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
