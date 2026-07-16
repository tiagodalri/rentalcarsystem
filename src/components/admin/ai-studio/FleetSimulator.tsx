import { useMemo, useState } from "react";
import { Gamepad2, X, ArrowRight, Sparkles, Trophy, Search, ShoppingCart, Tag, Plus, Minus, Brain } from "lucide-react";
import { findBrandByName, carLogoUrl } from "@/data/carBrands";
import AiOptimizerDialog from "./AiOptimizerDialog";

export type SimVehicle = {
  v: {
    id: string;
    name: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    category: string | null;
  } & Record<string, any>;
  revenue: number;
  exp: number;
  profit: number;
  daysBooked: number;
  daysInFleet: number;
  occupancy: number;
  roi: number;
  revPerDayOwned: number;
  paybackMonths: number | null;
  purchase: number;
  daily: number;
  adr: number;
  bookingsCount: number;
  hasAcquiredDate: boolean;
};

/* ── Private-bank palette (navy / ivory / gold) ── */
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
const SELL = "#a33a3a";       // muted bordeaux (vender)
const SELL_BG = "#fbecec";
const BUY = "#1f6b4c";        // muted forest (comprar)
const BUY_BG = "#e8f1ec";

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtUSDsigned = (n: number) =>
  `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

const COLOR_HEX: Record<string, string> = {
  preto: "#0a0a0a", black: "#0a0a0a",
  branco: "#f5f5f5", white: "#f5f5f5",
  prata: "#c0c4c8", silver: "#c0c4c8",
  cinza: "#6b7280", gray: "#6b7280", grey: "#6b7280",
  vermelho: "#dc2626", red: "#dc2626",
  azul: "#1d4ed8", blue: "#1d4ed8",
  verde: "#16a34a", green: "#16a34a",
  amarelo: "#eab308", yellow: "#eab308",
  laranja: "#ea580c", orange: "#ea580c",
  marrom: "#78350f", brown: "#78350f",
  bege: "#d6c7a3", beige: "#d6c7a3",
  dourado: "#b8860b", gold: "#b8860b",
};

function brandLogoUrl(v: SimVehicle["v"]): string | null {
  const raw = (v.brand || v.name?.split(" ")[0] || "").trim();
  if (!raw) return null;
  const match = findBrandByName(raw);
  if (match) return match.logoUrl;
  const slug = raw.toLowerCase().replace(/\s+/g, "-");
  return carLogoUrl(slug);
}

function BrandLogo({ v }: { v: SimVehicle["v"] }) {
  const url = brandLogoUrl(v);
  const initials = (v.brand || v.name || "?").slice(0, 2).toUpperCase();
  const [err, setErr] = useState(false);

  if (!url || err) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-semibold tracking-wider shrink-0"
        style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}`, color: NAVY_70 }}
      >
        {initials}
      </div>
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0"
      style={{ border: `1px solid ${NAVY_10}`, boxShadow: "0 2px 6px -3px rgba(13,29,46,0.18)" }}
    >
      <img
        src={url}
        alt={v.brand || ""}
        className="w-8 h-8 object-contain"
        onError={() => setErr(true)}
        loading="lazy"
      />
    </div>
  );
}

function ColorDot({ color }: { color: string | null }) {
  if (!color) return null;
  const hex = COLOR_HEX[color.toLowerCase().trim()] || "#9ca3af";
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: hex, border: `1px solid ${NAVY_10}` }}
      title={color}
    />
  );
}

function VehicleRow({
  p, side, action, selected, disabled,
}: {
  p: SimVehicle;
  side: "out" | "in";
  action: { label: string; onClick: () => void };
  selected?: boolean;
  disabled?: boolean;
}) {
  const year = (p.v as any).year || (p.v as any).model_year;
  const accent = side === "out" ? SELL : BUY;
  const accentBg = side === "out" ? SELL_BG : BUY_BG;
  const rowBg = selected ? accentBg : disabled ? IVORY_SOFT : "#ffffff";
  const rowBorder = selected ? `1px solid ${accent}55` : `1px solid ${NAVY_10}`;
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors"
      style={{
        background: rowBg,
        border: rowBorder,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <BrandLogo v={p.v} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] truncate" style={{ color: NAVY }}>
          <span className="truncate font-semibold">{p.v.name || `${p.v.brand ?? ""} ${p.v.model ?? ""}`.trim() || ""}</span>
          <ColorDot color={p.v.color} />
        </div>
        <div className="text-[10.5px] tabular-nums truncate flex items-center gap-1.5 mt-0.5" style={{ color: NAVY_55 }}>
          <span className="truncate">{[p.v.brand, p.v.model, year].filter(Boolean).join(" · ")}</span>
          {p.purchase > 0 ? (
            <>
              <span style={{ color: NAVY_40 }}>•</span>
              <span className="font-semibold" style={{ color: GOLD }}>Pago {fmtUSD(p.purchase)}</span>
            </>
          ) : (
            <>
              <span style={{ color: NAVY_40 }}>•</span>
              <span className="font-semibold" style={{ color: GOLD }}>Sem valor pago</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12.5px] tabular-nums leading-tight font-semibold" style={{ color: accent }}>
          {fmtUSD(p.revPerDayOwned)}/dia
        </div>
        <div className="text-[10.5px] tabular-nums" style={{ color: NAVY_55 }}>
          {p.occupancy.toFixed(0)}% uso
        </div>
      </div>
      <button
        onClick={disabled ? undefined : action.onClick}
        disabled={disabled}
        className="shrink-0 ml-1 text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-colors min-h-[32px] disabled:opacity-40 disabled:cursor-not-allowed"
        style={
          selected
            ? { background: NAVY, color: IVORY, border: `1px solid ${NAVY}` }
            : disabled
            ? { background: "#f0efe9", color: NAVY_55, border: `1px solid ${NAVY_10}` }
            : { background: accentBg, color: accent, border: `1px solid ${accent}40` }
        }
        aria-label={action.label}
      >
        {disabled ? "Bloqueado" : action.label}
      </button>
    </div>
  );
}


export default function FleetSimulator({ perVehicle }: { perVehicle: SimVehicle[] }) {
  const missingPrice = useMemo(
    () => perVehicle.filter(p => !(p.purchase > 0)),
    [perVehicle]
  );
  const priced = useMemo(
    () => perVehicle.filter(p => p.purchase > 0),
    [perVehicle]
  );

  const eligible = useMemo(
    () => priced.filter(p => p.hasAcquiredDate && p.daysInFleet >= 60 && p.bookingsCount > 0),
    [priced]
  );

  const [outIds, setOutIds] = useState<string[]>([]);
  const [inIds, setInIds] = useState<string[]>([]);
  const [inQty, setInQty] = useState<Record<string, number>>({});
  const [queryOut, setQueryOut] = useState("");
  const [queryIn, setQueryIn] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  const applyAiScenario = (sellIds: string[], buyIds: string[], qty: Record<string, number>) => {
    setOutIds(sellIds);
    setInIds(buyIds);
    setInQty(qty);
  };

  const qtyOf = (id: string) => inQty[id] ?? 1;

  /* Todos os carros aparecem; os sem valor pago ficam por último */
  const sortedByPerf = useMemo(
    () => {
      const withPrice = [...priced].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned);
      const withoutPrice = [...missingPrice].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned);
      return [...withPrice, ...withoutPrice];
    },
    [priced, missingPrice]
  );

  const matches = (p: SimVehicle, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [(p.v as any).name, (p.v as any).brand, (p.v as any).model]
      .filter(Boolean).join(" ").toLowerCase().includes(s);
  };

  const sellList = useMemo(
    () => {
      const withPriceAsc = [...priced].sort((a, b) => a.revPerDayOwned - b.revPerDayOwned);
      const withoutPriceAsc = [...missingPrice].sort((a, b) => a.revPerDayOwned - b.revPerDayOwned);
      return [...withPriceAsc, ...withoutPriceAsc].filter(p => matches(p, queryOut) && !inIds.includes(p.v.id));
    },
    [priced, missingPrice, queryOut, inIds]
  );
  const buyList = useMemo(
    () => sortedByPerf.filter(p => matches(p, queryIn) && !outIds.includes(p.v.id)),
    [sortedByPerf, queryIn, outIds]
  );

  const outList = outIds.map(id => perVehicle.find(p => p.v.id === id)).filter(Boolean) as SimVehicle[];
  const inList = inIds.map(id => perVehicle.find(p => p.v.id === id)).filter(Boolean) as SimVehicle[];

  const inTotalUnits = inList.reduce((s, p) => s + qtyOf(p.v.id), 0);

  const sellCapitalLive = outList.reduce((s, p) => s + (p.purchase || 0), 0);
  const buyCapitalLive = inList.reduce((s, p) => s + (p.purchase || 0) * qtyOf(p.v.id), 0);
  const balanceLive = sellCapitalLive - buyCapitalLive;

  const result = useMemo(() => {
    if (!outList.length || !inList.length) return null;
    const outRev = outList.reduce((s, p) => s + p.revPerDayOwned, 0);
    const outOcc = outList.reduce((s, p) => s + p.occupancy, 0) / outList.length;
    const outCapital = outList.reduce((s, p) => s + p.purchase, 0);

    const totalUnits = inList.reduce((s, p) => s + qtyOf(p.v.id), 0);
    const inRevTotal = inList.reduce((s, p) => s + p.revPerDayOwned * qtyOf(p.v.id), 0);
    const inOccWeighted = inList.reduce((s, p) => s + p.occupancy * qtyOf(p.v.id), 0) / Math.max(1, totalUnits);
    const inCapital = inList.reduce((s, p) => s + p.purchase * qtyOf(p.v.id), 0);
    const inAvgRev = inRevTotal / Math.max(1, totalUnits);

    const projectedRevPerDay = inRevTotal;
    const deltaPerDay = projectedRevPerDay - outRev;

    const inPayback = inList.filter(p => p.paybackMonths !== null).map(p => p.paybackMonths!);
    const avgInPayback = inPayback.length ? inPayback.reduce((s, x) => s + x, 0) / inPayback.length : null;

    return {
      outRev, outOcc, outCapital,
      inAvgRev, inAvgOcc: inOccWeighted, inCapital,
      deltaPerDay,
      delta90: deltaPerDay * 90,
      delta180: deltaPerDay * 180,
      delta365: deltaPerDay * 365,
      capitalDelta: inCapital - outCapital,
      capitalEfficiency: outCapital > 0 && inCapital > 0 ? ((projectedRevPerDay / inCapital) / (outRev / outCapital) - 1) * 100 : 0,
      avgInPayback,
      count: outList.length,
      buyUnits: totalUnits,
    };
  }, [outList, inList, inQty]);

  const toggleOut = (id: string) => {
    const target = perVehicle.find(p => p.v.id === id);
    if (!target || !(target.purchase > 0)) return;
    setOutIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleIn = (id: string) => {
    const target = perVehicle.find(p => p.v.id === id);
    if (!target || !(target.purchase > 0)) return;
    setInIds(prev => {
      if (prev.includes(id)) {
        setInQty(q => { const n = { ...q }; delete n[id]; return n; });
        return prev.filter(x => x !== id);
      }
      setInQty(q => ({ ...q, [id]: q[id] ?? 1 }));
      return [...prev, id];
    });
  };
  const incQty = (id: string) => setInQty(q => ({ ...q, [id]: Math.min(99, (q[id] ?? 1) + 1) }));
  const decQty = (id: string) => setInQty(q => ({ ...q, [id]: Math.max(1, (q[id] ?? 1) - 1) }));

  const reset = () => { setOutIds([]); setInIds([]); setInQty({}); };

  /* Wrapper card — ivory premium */
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(180deg, ${IVORY} 0%, ${IVORY_SOFT} 100%)`,
        border: `1px solid ${NAVY_10}`,
        boxShadow: "0 12px 32px -20px rgba(13,29,46,0.25), 0 0 0 1px rgba(255,255,255,0.6) inset",
      }}
    >
      {/* hairline gold top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD_SOFT} 30%, ${GOLD} 50%, ${GOLD_SOFT} 70%, transparent)` }}
      />

      <div className="relative p-4 sm:p-6">
        {/* Header */}
        <div className="relative flex items-center justify-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0"
              style={{ background: NAVY }}
            >
              <Gamepad2 size={13} style={{ color: "#d6bf86" }} />
            </span>
            <span
              className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: NAVY }}
            >
              Simulador de renovação
            </span>
          </div>
          <div className="absolute right-0 top-0 flex items-center gap-1.5">
            <button
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors min-h-[32px]"
              style={{ background: NAVY, color: IVORY, border: `1px solid ${NAVY}` }}
              title="Deixe a IA escolher o melhor cenário"
            >
              <Brain className="w-3 h-3" style={{ color: GOLD_SOFT }} />
              Simular com IA
            </button>
            {(outIds.length > 0 || inIds.length > 0) && (
              <button
                onClick={reset}
                className="text-[10.5px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors min-h-[32px]"
                style={{ background: "#ffffff", color: NAVY_70, border: `1px solid ${NAVY_10}` }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        <h3
          className="text-[20px] sm:text-[22px] font-medium leading-snug mb-2 text-center"
          style={{ color: NAVY, letterSpacing: "-0.01em" }}
        >
          Quanto sua frota renderia se você trocasse alguns carros?
        </h3>
        <p
          className="text-[13px] sm:text-[13.5px] mb-4 leading-[1.55] max-w-2xl text-center mx-auto"
          style={{ color: NAVY_70 }}
        >
          Escolha carros para{" "}
          <span className="font-semibold" style={{ color: SELL }}>vender</span>{" "}
          e{" "}
          <span className="font-semibold" style={{ color: BUY }}>comprar</span>.
          O simulador calcula o impacto em tempo real a partir do histórico real da frota.
        </p>


        {/* BALANÇO DE CAPITAL */}
        {(outList.length > 0 || inList.length > 0) && (
          <div
            className="mb-5 rounded-xl grid grid-cols-1 sm:grid-cols-3"
            style={{
              background: "#ffffff",
              border: `1px solid ${NAVY_10}`,
              boxShadow: "0 4px 14px -10px rgba(13,29,46,0.20)",
            }}
          >
            <div className="p-4 sm:border-r" style={{ borderColor: NAVY_06 }}>
              <div className="text-[9.5px] uppercase tracking-[0.20em] font-semibold mb-1.5" style={{ color: NAVY_55 }}>
                Capital recuperado
              </div>
              <div className="text-[24px] sm:text-[26px] font-semibold tabular-nums leading-none" style={{ color: SELL, letterSpacing: "-0.01em" }}>
                {fmtUSD(sellCapitalLive)}
              </div>
              <div className="text-[10.5px] tabular-nums mt-2" style={{ color: NAVY_55 }}>
                {outList.length} carro{outList.length === 1 ? "" : "s"} marcado{outList.length === 1 ? "" : "s"} para venda
              </div>
            </div>
            <div className="p-4 sm:border-r" style={{ borderColor: NAVY_06, borderTop: `1px solid ${NAVY_06}`, borderTopWidth: 0 }}>
              <div className="text-[9.5px] uppercase tracking-[0.20em] font-semibold mb-1.5" style={{ color: NAVY_55 }}>
                Capital reinvestido
              </div>
              <div className="text-[24px] sm:text-[26px] font-semibold tabular-nums leading-none" style={{ color: BUY, letterSpacing: "-0.01em" }}>
                {fmtUSD(buyCapitalLive)}
              </div>
              <div className="text-[10.5px] tabular-nums mt-2" style={{ color: NAVY_55 }}>
                {inTotalUnits} unidade{inTotalUnits === 1 ? "" : "s"} · {inList.length} modelo{inList.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[9.5px] uppercase tracking-[0.20em] font-semibold mb-1.5" style={{ color: NAVY_55 }}>
                Saldo em caixa
              </div>
              <div
                className="text-[24px] sm:text-[26px] font-semibold tabular-nums leading-none"
                style={{ color: balanceLive >= 0 ? BUY : GOLD, letterSpacing: "-0.01em" }}
              >
                {fmtUSDsigned(balanceLive)}
              </div>
              <div className="text-[10.5px] mt-2" style={{ color: NAVY_55 }}>
                {balanceLive >= 0 ? "sobra de caixa após a troca" : "precisa aportar para fechar"}
              </div>
            </div>
          </div>
        )}

        {/* Duas colunas: VENDER | COMPRAR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* VENDER */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#ffffff", border: `1px solid ${SELL}25`, boxShadow: "0 4px 14px -10px rgba(13,29,46,0.15)" }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: SELL_BG, border: `1px solid ${SELL}30` }}
                >
                  <Tag className="w-4 h-4" style={{ color: SELL }} />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] font-semibold leading-none" style={{ color: SELL }}>
                    Vender
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: NAVY_55 }}>
                    {outList.length} carro{outList.length === 1 ? "" : "s"} · recupera{" "}
                    <span className="font-semibold tabular-nums" style={{ color: SELL }}>{fmtUSD(sellCapitalLive)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-2 rounded-md px-2.5 py-2 mb-3"
              style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}` }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: NAVY_55 }} />
              <input
                value={queryOut}
                onChange={e => setQueryOut(e.target.value)}
                placeholder="Buscar carro para vender…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: NAVY }}
              />
            </div>

            {outList.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: SELL }}>
                  Saindo
                </div>
                <div className="space-y-1.5 mb-4">
                  {outList.map(p => (
                    <VehicleRow
                      key={p.v.id}
                      p={p}
                      side="out"
                      selected
                      action={{ label: "Remover", onClick: () => toggleOut(p.v.id) }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: NAVY_55 }}>
              Frota completa · pior desempenho primeiro
            </div>
            <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
              {sellList.filter(p => !outIds.includes(p.v.id)).map(p => (
                <VehicleRow
                  key={p.v.id}
                  p={p}
                  side="out"
                  disabled={!(p.purchase > 0)}
                  action={{ label: "+ Vender", onClick: () => toggleOut(p.v.id) }}
                />
              ))}
            </div>
          </div>

          {/* COMPRAR */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#ffffff", border: `1px solid ${BUY}25`, boxShadow: "0 4px 14px -10px rgba(13,29,46,0.15)" }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: BUY_BG, border: `1px solid ${BUY}30` }}
                >
                  <ShoppingCart className="w-4 h-4" style={{ color: BUY }} />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] font-semibold leading-none" style={{ color: BUY }}>
                    Comprar
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: NAVY_55 }}>
                    {inTotalUnits} unidade{inTotalUnits === 1 ? "" : "s"} · investe{" "}
                    <span className="font-semibold tabular-nums" style={{ color: BUY }}>{fmtUSD(buyCapitalLive)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-2 rounded-md px-2.5 py-2 mb-3"
              style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}` }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: NAVY_55 }} />
              <input
                value={queryIn}
                onChange={e => setQueryIn(e.target.value)}
                placeholder="Buscar carro de referência…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: NAVY }}
              />
            </div>

            {inList.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5" style={{ color: BUY }}>
                  <Trophy className="w-3 h-3" /> Referência
                </div>
                <div className="space-y-1.5 mb-4">
                  {inList.map(p => {
                    const q = qtyOf(p.v.id);
                    const year = (p.v as any).year || (p.v as any).model_year;
                    return (
                      <div
                        key={p.v.id}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                        style={{ background: BUY_BG, border: `1px solid ${BUY}40` }}
                      >
                        <BrandLogo v={p.v} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[13px] truncate" style={{ color: NAVY }}>
                            <span className="truncate font-semibold">{p.v.name || `${p.v.brand ?? ""} ${p.v.model ?? ""}`.trim() || ""}</span>
                            <ColorDot color={p.v.color} />
                          </div>
                          <div className="text-[10.5px] tabular-nums truncate flex items-center gap-1.5 mt-0.5" style={{ color: NAVY_55 }}>
                            <span className="truncate">{[p.v.brand, p.v.model, year].filter(Boolean).join(" · ")}</span>
                            {p.purchase > 0 && (
                              <>
                                <span style={{ color: NAVY_40 }}>•</span>
                                <span className="font-semibold" style={{ color: GOLD }}>
                                  {q > 1 ? `${q}× ${fmtUSD(p.purchase)} = ${fmtUSD(p.purchase * q)}` : `Pago ${fmtUSD(p.purchase)}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Stepper */}
                        <div
                          className="shrink-0 flex items-center rounded-md overflow-hidden"
                          style={{ background: "#ffffff", border: `1px solid ${BUY}40` }}
                        >
                          <button
                            type="button"
                            onClick={() => decQty(p.v.id)}
                            disabled={q <= 1}
                            className="h-8 w-8 flex items-center justify-center disabled:opacity-30 transition-colors"
                            style={{ color: BUY }}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <div className="min-w-[28px] text-center text-[13px] font-semibold tabular-nums px-1 select-none" style={{ color: NAVY }}>
                            {q}
                          </div>
                          <button
                            type="button"
                            onClick={() => incQty(p.v.id)}
                            disabled={q >= 99}
                            className="h-8 w-8 flex items-center justify-center disabled:opacity-30 transition-colors"
                            style={{ color: BUY }}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => toggleIn(p.v.id)}
                          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md transition-colors"
                          style={{ background: "#ffffff", color: NAVY_70, border: `1px solid ${NAVY_10}` }}
                          aria-label="Remover"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: NAVY_55 }}>
              Frota completa · melhor desempenho primeiro
            </div>
            <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
              {buyList.filter(p => !inIds.includes(p.v.id)).map(p => (
                <VehicleRow
                  key={p.v.id}
                  p={p}
                  side="in"
                  disabled={!(p.purchase > 0)}
                  action={{ label: "+ Comprar", onClick: () => toggleIn(p.v.id) }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RESULTADO */}
        <div
          className="mt-5 rounded-xl p-5 relative overflow-hidden"
          style={{ background: "#ffffff", border: `1px solid ${GOLD}30`, boxShadow: "0 8px 24px -16px rgba(13,29,46,0.22)" }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, ${GOLD}, ${GOLD_SOFT}, transparent)` }}
          />
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
            <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY }}>
              Resultado da simulação
            </span>
          </div>

          {!result ? (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}` }}
              >
                <ArrowRight className="w-5 h-5" style={{ color: NAVY_55 }} />
              </div>
              <p className="text-[13px] max-w-[360px] leading-[1.6] mb-5" style={{ color: NAVY_70 }}>
                Escolha pelo menos 1 carro para{" "}
                <span className="font-semibold" style={{ color: SELL }}>vender</span> e 1 para{" "}
                <span className="font-semibold" style={{ color: BUY }}>comprar</span> para ver os números.
              </p>

              <div className="flex items-center gap-2 mb-3">
                <span className="h-px w-10" style={{ background: NAVY_10 }} />
                <span className="text-[9.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY_40 }}>
                  ou deixe a IA decidir por você
                </span>
                <span className="h-px w-10" style={{ background: NAVY_10 }} />
              </div>

              <button
                onClick={() => setAiOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[12.5px] font-semibold uppercase tracking-wider min-h-[48px] transition-all hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${NAVY} 0%, #1a2d44 100%)`,
                  color: IVORY,
                  boxShadow: `0 10px 28px -14px rgba(13,29,46,0.55), 0 0 0 1px ${GOLD}30`,
                }}
              >
                <Brain className="w-4 h-4" style={{ color: GOLD_SOFT }} />
                Simular com IA
                <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD_SOFT }} />
              </button>
              <p className="text-[10.5px] mt-3 max-w-[320px]" style={{ color: NAVY_40 }}>
                A IA estuda todas as combinações possíveis e devolve o melhor cenário com os números do seu próprio histórico.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Hero delta */}
              <div className="md:col-span-4">
                <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-2" style={{ color: NAVY_55 }}>
                  Diferença por dia
                </div>
                <div
                  className="text-[40px] md:text-[48px] font-semibold tabular-nums leading-none"
                  style={{ color: result.deltaPerDay >= 0 ? BUY : SELL, letterSpacing: "-0.02em" }}
                >
                  {fmtUSDsigned(result.deltaPerDay)}
                </div>
                <div className="text-[12px] tabular-nums mt-3" style={{ color: NAVY_55 }}>
                  Hoje <span className="font-semibold" style={{ color: NAVY }}>{fmtUSD(result.outRev)}/dia</span> → projetado{" "}
                  <span className="font-semibold" style={{ color: NAVY }}>{fmtUSD(result.outRev + result.deltaPerDay)}/dia</span>
                </div>
              </div>

              {/* Projeções */}
              <div className="md:col-span-8 grid grid-cols-3 gap-2">
                {[
                  { label: "90 dias", value: result.delta90 },
                  { label: "6 meses", value: result.delta180 },
                  { label: "12 meses", value: result.delta365 },
                ].map(h => (
                  <div
                    key={h.label}
                    className="rounded-lg p-3"
                    style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}` }}
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: NAVY_55 }}>
                      {h.label}
                    </div>
                    <div
                      className="text-[18px] md:text-[20px] font-semibold tabular-nums leading-tight mt-1.5"
                      style={{ color: h.value >= 0 ? BUY : SELL, letterSpacing: "-0.01em" }}
                    >
                      {fmtUSDsigned(h.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detalhes */}
              <div
                className="md:col-span-12 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2"
                style={{ background: IVORY_SOFT, border: `1px solid ${NAVY_10}` }}
              >
                {[
                  ["Uso médio (vendidos)", `${result.outOcc.toFixed(0)}%`, SELL],
                  ["Uso médio (comprados)", `${result.inAvgOcc.toFixed(0)}%`, BUY],
                  ["Capital reciclado (venda)", fmtUSD(result.outCapital), NAVY],
                  ["Capital p/ comprar", `${fmtUSD(result.inCapital)} (${result.capitalDelta >= 0 ? "+" : "−"}${fmtUSD(Math.abs(result.capitalDelta))})`, result.capitalDelta > 0 ? GOLD : BUY],
                  ...(result.avgInPayback !== null ? [["Payback médio da compra", `${result.avgInPayback.toFixed(0)} meses`, GOLD] as [string, string, string]] : []),
                  ["Eficiência do capital", `${result.capitalEfficiency >= 0 ? "+" : ""}${result.capitalEfficiency.toFixed(0)}%`, result.capitalEfficiency >= 0 ? BUY : SELL],
                ].map(([label, value, color], idx) => (
                  <div key={idx} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: NAVY_70 }}>{label}</span>
                    <span className="tabular-nums font-semibold" style={{ color: color as string }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Conclusão estruturada */}
              {(() => {
                const nameOf = (p: SimVehicle) =>
                  p.v.name || `${p.v.brand ?? ""} ${p.v.model ?? ""}`.trim() || "carro";
                const listNames = (arr: string[]) => {
                  if (arr.length === 0) return "";
                  if (arr.length === 1) return arr[0];
                  if (arr.length === 2) return `${arr[0]} e ${arr[1]}`;
                  return `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;
                };
                const sellNames = listNames(outList.map(nameOf));
                const buyParts = inList.map(p => {
                  const q = qtyOf(p.v.id);
                  return q > 1 ? `${q}× ${nameOf(p)}` : nameOf(p);
                });
                const buyNames = listNames(buyParts);
                const sign = result.deltaPerDay >= 0 ? "+" : "−";
                const abs = (n: number) => fmtUSD(Math.abs(n));
                const deltaWord = result.deltaPerDay >= 0 ? "subiria" : "cairia";
                const capWord = result.capitalDelta <= 0 ? "sobrando" : "exigindo aporte de";
                const capValue = abs(result.capitalDelta);
                const effWord = result.capitalEfficiency >= 0 ? "mais eficiente" : "menos eficiente";

                return (
                  <div
                    className="md:col-span-12 rounded-lg p-5"
                    style={{ background: IVORY_SOFT, border: `1px solid ${GOLD}30` }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      <span className="text-[10.5px] uppercase tracking-[0.22em] font-semibold" style={{ color: NAVY }}>
                        Conclusão da análise
                      </span>
                    </div>

                    <p
                      style={{
                        fontFamily: '"Söhne", "Inter", ui-sans-serif, system-ui, sans-serif',
                        fontSize: "14px",
                        lineHeight: 1.75,
                        letterSpacing: "-0.005em",
                        fontWeight: 420,
                        color: NAVY,
                      }}
                    >
                      <span className="font-semibold">Bruno,</span>{" "}
                      se você vender{" "}
                      <span className="font-semibold" style={{ color: SELL }}>
                        {outList.length} carro{outList.length === 1 ? "" : "s"}
                      </span>{" "}
                      ({sellNames}) e comprar{" "}
                      <span className="font-semibold" style={{ color: BUY }}>
                        {result.buyUnits} unidade{result.buyUnits === 1 ? "" : "s"}
                      </span>{" "}
                      de {buyNames}, o seu resultado mudaria desta forma: a receita diária{" "}
                      <span className="font-semibold tabular-nums" style={{ color: result.deltaPerDay >= 0 ? BUY : SELL }}>
                        {deltaWord} {sign}{abs(result.deltaPerDay)}
                      </span>{" "}
                      (de {fmtUSD(result.outRev)} para {fmtUSD(result.outRev + result.deltaPerDay)} por dia), o que se traduz em{" "}
                      <span className="font-semibold tabular-nums" style={{ color: result.delta365 >= 0 ? BUY : SELL }}>
                        {sign}{abs(result.delta365)} em 12 meses
                      </span>
                      . O capital reciclado pela venda ({fmtUSD(result.outCapital)}) seria reinvestido em {fmtUSD(result.inCapital)},{" "}
                      {result.capitalDelta === 0 ? (
                        <>sem variação líquida de caixa</>
                      ) : (
                        <>
                          {capWord}{" "}
                          <span className="font-semibold tabular-nums" style={{ color: result.capitalDelta <= 0 ? BUY : GOLD }}>
                            {capValue}
                          </span>
                        </>
                      )}
                      . O capital empregado ficaria{" "}
                      <span className="font-semibold tabular-nums" style={{ color: result.capitalEfficiency >= 0 ? BUY : SELL }}>
                        {Math.abs(result.capitalEfficiency).toFixed(0)}% {effWord}
                      </span>
                      {result.avgInPayback !== null && (
                        <>
                          , com payback médio de{" "}
                          <span className="font-semibold tabular-nums" style={{ color: GOLD }}>
                            {result.avgInPayback.toFixed(0)} meses
                          </span>{" "}
                          nos carros novos
                        </>
                      )}
                      .
                    </p>

                    <div className="mt-4 pt-4 flex items-start gap-2.5" style={{ borderTop: `1px solid ${NAVY_10}` }}>
                      <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ background: GOLD }} />
                      <p className="text-[11.5px] leading-[1.65]" style={{ color: NAVY_55 }}>
                        <span className="font-semibold" style={{ color: GOLD }}>Aviso:</span> resultados passados não garantem resultados futuros. Esta análise é construída sobre o histórico real de locações, ocupação, receita e custo de aquisição da sua frota. Portanto carrega valor analítico real para decisão, mas não substitui o julgamento operacional de mercado, sazonalidade e contexto do momento.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <p className="md:col-span-12 text-[11px] leading-relaxed" style={{ color: NAVY_55 }}>
                Cenário hipotético. Assume que cada carro novo atinge a média histórica do grupo de referência. Apenas carros com 60+ dias de uso real estão disponíveis.
              </p>
            </div>
          )}
        </div>

        {eligible.length < 4 && (
          <p className="text-[11.5px] mt-3" style={{ color: GOLD }}>
            Você ainda tem poucos carros com 60+ dias de histórico ({eligible.length}). O simulador fica mais preciso conforme a frota acumula dados.
          </p>
        )}

        {missingPrice.length > 0 && (
          <div
            className="mt-6 rounded-xl p-4"
            style={{
              background: "#fff8ec",
              border: `1px solid ${GOLD}40`,
              boxShadow: "0 4px 14px -10px rgba(154,122,58,0.25)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold"
                style={{ background: GOLD, color: IVORY }}
                aria-hidden
              >
                !
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold mb-1" style={{ color: NAVY }}>
                  {missingPrice.length} carro{missingPrice.length === 1 ? "" : "s"} fora do simulador. Sem valor pago cadastrado
                </div>
                <div className="text-[12px] leading-[1.6] mb-2" style={{ color: NAVY_70 }}>
                  Para entrar na simulação, o veículo precisa ter o <span className="font-semibold" style={{ color: NAVY }}>valor pago na aquisição</span> registrado na ficha da frota. Sem esse dado não é possível calcular capital, ROI nem payback.
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {missingPrice.slice(0, 12).map(p => (
                    <span
                      key={p.v.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium"
                      style={{ background: IVORY, color: NAVY, border: `1px solid ${NAVY_10}` }}
                    >
                      {p.v.name || `${p.v.brand ?? ""} ${p.v.model ?? ""}`.trim() || ""}
                    </span>
                  ))}
                  {missingPrice.length > 12 && (
                    <span className="text-[11px] self-center" style={{ color: NAVY_55 }}>
                      +{missingPrice.length - 12}
                    </span>
                  )}
                </div>
                <a
                  href="/admin/fleet"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wider"
                  style={{ color: GOLD }}
                >
                  Cadastrar valor na frota <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <AiOptimizerDialog
        perVehicle={perVehicle}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onApply={applyAiScenario}
      />
    </div>
  );
}
