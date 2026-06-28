import { useMemo, useState } from "react";
import { Gamepad2, X, ArrowRight, Sparkles, TrendingUp, TrendingDown, Trophy, Search, ShoppingCart, Tag, Plus, Minus } from "lucide-react";
import { findBrandByName, carLogoUrl } from "@/data/carBrands";

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
  // tentativa direta por slug
  const slug = raw.toLowerCase().replace(/\s+/g, "-");
  return carLogoUrl(slug);
}

function BrandLogo({ v }: { v: SimVehicle["v"] }) {
  const url = brandLogoUrl(v);
  const initials = (v.brand || v.name || "?").slice(0, 2).toUpperCase();
  const [err, setErr] = useState(false);

  if (!url || err) {
    return (
      <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[10px] font-semibold text-white/80 tracking-wider shrink-0">
        {initials}
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-white/15 shrink-0 shadow-sm">
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
      className="inline-block w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
      style={{ background: hex }}
      title={color}
    />
  );
}

function VehicleRow({
  p, side, action, selected,
}: {
  p: SimVehicle;
  side: "out" | "in";
  action: { label: string; onClick: () => void };
  selected?: boolean;
}) {
  const year = (p.v as any).year || (p.v as any).model_year;
  const tone = side === "out" ? "text-rose-200" : "text-emerald-200";
  const ring = selected
    ? side === "out"
      ? "border-rose-400/50 bg-rose-500/[0.07]"
      : "border-emerald-400/50 bg-emerald-500/[0.07]"
    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors ${ring}`}>
      <BrandLogo v={p.v} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] text-white truncate">
          <span className="truncate font-medium">{p.v.name || `${p.v.brand ?? ""} ${p.v.model ?? ""}`.trim() || "—"}</span>
          <ColorDot color={p.v.color} />
        </div>
        <div className="text-[10.5px] text-white/50 tabular-nums truncate flex items-center gap-1.5">
          <span className="truncate">{[p.v.brand, p.v.model, year].filter(Boolean).join(" · ")}</span>
          {p.purchase > 0 && (
            <>
              <span className="text-white/20">•</span>
              <span className="text-amber-300/80 font-medium">pago {fmtUSD(p.purchase)}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[12px] ${tone} tabular-nums leading-tight font-medium`}>{fmtUSD(p.revPerDayOwned)}/dia</div>
        <div className="text-[10px] text-white/45 tabular-nums">{p.occupancy.toFixed(0)}% uso</div>
      </div>
      <button
        onClick={action.onClick}
        className={`shrink-0 ml-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${
          selected
            ? "bg-white/10 hover:bg-white/20 border-white/20 text-white"
            : side === "out"
              ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-400/40 text-rose-100"
              : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-400/40 text-emerald-100"
        }`}
        aria-label={action.label}
      >
        {action.label}
      </button>
    </div>
  );
}


export default function FleetSimulator({ perVehicle }: { perVehicle: SimVehicle[] }) {
  const eligible = useMemo(
    () => perVehicle.filter(p => p.hasAcquiredDate && p.daysInFleet >= 60 && p.bookingsCount > 0),
    [perVehicle]
  );

  const [outIds, setOutIds] = useState<string[]>([]);
  const [inIds, setInIds] = useState<string[]>([]);
  const [inQty, setInQty] = useState<Record<string, number>>({});
  const [queryOut, setQueryOut] = useState("");
  const [queryIn, setQueryIn] = useState("");

  const qtyOf = (id: string) => inQty[id] ?? 1;

  const sortedByPerf = useMemo(
    () => [...eligible].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned),
    [eligible]
  );

  const matches = (p: SimVehicle, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [(p.v as any).name, (p.v as any).brand, (p.v as any).model]
      .filter(Boolean).join(" ").toLowerCase().includes(s);
  };

  // Para VENDER: mostra do pior pro melhor
  const sellList = useMemo(
    () => [...sortedByPerf].reverse().filter(p => matches(p, queryOut)),
    [sortedByPerf, queryOut]
  );
  // Para COMPRAR (referência): top desempenho
  const buyList = useMemo(
    () => sortedByPerf.filter(p => matches(p, queryIn)),
    [sortedByPerf, queryIn]
  );

  const outList = outIds.map(id => eligible.find(p => p.v.id === id)).filter(Boolean) as SimVehicle[];
  const inList = inIds.map(id => eligible.find(p => p.v.id === id)).filter(Boolean) as SimVehicle[];

  // Unidades totais a comprar (soma das qtds)
  const inTotalUnits = inList.reduce((s, p) => s + qtyOf(p.v.id), 0);

  // Totalizadores ao vivo (independentes do resultado completo)
  const sellCapitalLive = outList.reduce((s, p) => s + (p.purchase || 0), 0);
  const buyCapitalLive = inList.reduce((s, p) => s + (p.purchase || 0) * qtyOf(p.v.id), 0);
  const balanceLive = sellCapitalLive - buyCapitalLive;


  const result = useMemo(() => {
    if (!outList.length || !inList.length) return null;
    const outRev = outList.reduce((s, p) => s + p.revPerDayOwned, 0);
    const outOcc = outList.reduce((s, p) => s + p.occupancy, 0) / outList.length;
    const outCapital = outList.reduce((s, p) => s + p.purchase, 0);

    // Cada compra entra ponderada pela quantidade selecionada
    const totalUnits = inList.reduce((s, p) => s + qtyOf(p.v.id), 0);
    const inRevTotal = inList.reduce((s, p) => s + p.revPerDayOwned * qtyOf(p.v.id), 0);
    const inOccWeighted = inList.reduce((s, p) => s + p.occupancy * qtyOf(p.v.id), 0) / Math.max(1, totalUnits);
    const inCapital = inList.reduce((s, p) => s + p.purchase * qtyOf(p.v.id), 0);
    const inAvgRev = inRevTotal / Math.max(1, totalUnits);

    const projectedRevPerDay = inRevTotal; // já é a soma com qtd
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

  const toggleOut = (id: string) =>
    setOutIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleIn = (id: string) =>
    setInIds(prev => {
      if (prev.includes(id)) {
        setInQty(q => { const n = { ...q }; delete n[id]; return n; });
        return prev.filter(x => x !== id);
      }
      setInQty(q => ({ ...q, [id]: q[id] ?? 1 }));
      return [...prev, id];
    });
  const incQty = (id: string) => setInQty(q => ({ ...q, [id]: Math.min(99, (q[id] ?? 1) + 1) }));
  const decQty = (id: string) => setInQty(q => ({ ...q, [id]: Math.max(1, (q[id] ?? 1) - 1) }));

  const reset = () => { setOutIds([]); setInIds([]); setInQty({}); };

  return (
    <div className="ai-card relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-emerald-400/12 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="relative">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Gamepad2 className="w-4 h-4 text-emerald-300" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/90 font-semibold">Simulador Inteligente</span>
          </div>
          {(outIds.length > 0 || inIds.length > 0) && (
            <button
              onClick={reset}
              className="text-[10.5px] uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
            >
              Limpar tudo
            </button>
          )}
        </div>
        <h3 className="text-xl md:text-2xl font-light text-white leading-snug mb-1 tracking-tight">
          Renovação de Frota
        </h3>
        <p className="text-[12px] text-white/55 mb-4 leading-relaxed max-w-3xl">
          Escolha quais carros <span className="text-rose-300 font-medium">vender</span> e quais <span className="text-emerald-300 font-medium">comprar</span>. O simulador soma o valor investido em tempo real e projeta o impacto financeiro da troca.
        </p>

        {/* BALANÇO DE CAPITAL — ticker ao vivo */}
        {(outList.length > 0 || inList.length > 0) && (
          <div className="mb-3 rounded-xl border border-white/10 bg-gradient-to-r from-rose-500/[0.06] via-white/[0.02] to-emerald-500/[0.06] p-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Capital recuperado</div>
              <div className="text-xl md:text-2xl font-semibold text-rose-300 tabular-nums leading-none">
                {fmtUSD(sellCapitalLive)}
              </div>
              <div className="text-[10px] text-white/40 tabular-nums mt-1">{outList.length} carro{outList.length === 1 ? "" : "s"} vendendo</div>
            </div>
            <div className="border-x border-white/10 px-2">
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Capital reinvestido</div>
              <div className="text-xl md:text-2xl font-semibold text-emerald-300 tabular-nums leading-none">
                {fmtUSD(buyCapitalLive)}
              </div>
              <div className="text-[10px] text-white/40 tabular-nums mt-1">{inTotalUnits} unidade{inTotalUnits === 1 ? "" : "s"} · {inList.length} modelo{inList.length === 1 ? "" : "s"}</div>
            </div>
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Saldo</div>
              <div className={`text-xl md:text-2xl font-semibold tabular-nums leading-none ${
                balanceLive >= 0 ? "text-emerald-400" : "text-amber-400"
              }`}>
                {fmtUSDsigned(balanceLive)}
              </div>
              <div className="text-[10px] text-white/40 mt-1">
                {balanceLive >= 0 ? "sobra em caixa" : "precisa aportar"}
              </div>
            </div>
          </div>
        )}



        {/* Duas colunas: VENDER | COMPRAR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* VENDER */}
          <div className="rounded-xl bg-rose-500/[0.05] border border-rose-400/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                  <Tag className="w-4 h-4 text-rose-300" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] text-rose-100 font-semibold leading-none">Vender</div>
                  <div className="text-[10px] text-white/45 mt-0.5">{outList.length} carro{outList.length === 1 ? "" : "s"} · recupera <span className="text-rose-200 font-medium tabular-nums">{fmtUSD(sellCapitalLive)}</span></div>
                </div>
              </div>
            </div>


            <div className="flex items-center gap-2 flex-1 rounded-md bg-white/[0.04] border border-white/10 px-2.5 py-1.5 mb-2.5">
              <Search className="w-3.5 h-3.5 text-white/40" />
              <input
                value={queryOut}
                onChange={e => setQueryOut(e.target.value)}
                placeholder="Buscar carro para vender…"
                className="flex-1 bg-transparent text-[12.5px] text-white placeholder:text-white/30 outline-none"
              />
            </div>

            {outList.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-rose-200/70 mb-1.5">Saindo</div>
                <div className="space-y-1.5 mb-3">
                  {outList.map(p => (
                    <VehicleRow
                      key={p.v.id}
                      p={p}
                      side="out"
                      selected
                      action={{ label: "✕", onClick: () => toggleOut(p.v.id) }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Disponíveis (pior desempenho primeiro)</div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {sellList.filter(p => !outIds.includes(p.v.id)).slice(0, 40).map(p => (
                <VehicleRow
                  key={p.v.id}
                  p={p}
                  side="out"
                  action={{ label: "+ Vender", onClick: () => toggleOut(p.v.id) }}
                />
              ))}
            </div>
          </div>

          {/* COMPRAR */}
          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-400/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <ShoppingCart className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] text-emerald-100 font-semibold leading-none">Comprar</div>
                  <div className="text-[10px] text-white/45 mt-0.5">{inList.length} carro{inList.length === 1 ? "" : "s"} · investe <span className="text-emerald-200 font-medium tabular-nums">{fmtUSD(buyCapitalLive)}</span></div>
                </div>
              </div>
            </div>


            <div className="flex items-center gap-2 flex-1 rounded-md bg-white/[0.04] border border-white/10 px-2.5 py-1.5 mb-2.5">
              <Search className="w-3.5 h-3.5 text-white/40" />
              <input
                value={queryIn}
                onChange={e => setQueryIn(e.target.value)}
                placeholder="Buscar carro de referência…"
                className="flex-1 bg-transparent text-[12.5px] text-white placeholder:text-white/30 outline-none"
              />
            </div>

            {inList.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-emerald-200/70 mb-1.5 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> Referência
                </div>
                <div className="space-y-1.5 mb-3">
                  {inList.map(p => (
                    <VehicleRow
                      key={p.v.id}
                      p={p}
                      side="in"
                      selected
                      action={{ label: "✕", onClick: () => toggleIn(p.v.id) }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Top desempenho da frota</div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {buyList.filter(p => !inIds.includes(p.v.id)).slice(0, 40).map(p => (
                <VehicleRow
                  key={p.v.id}
                  p={p}
                  side="in"
                  action={{ label: "+ Comprar", onClick: () => toggleIn(p.v.id) }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RESULTADO — largura total embaixo */}
        <div className="mt-4 rounded-xl bg-gradient-to-br from-amber-500/[0.06] via-white/[0.02] to-emerald-500/[0.07] border border-amber-300/25 p-4 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[10.5px] uppercase tracking-wider text-amber-200/85">Resultado da simulação</span>
          </div>

          {!result ? (
            <div className="flex flex-col items-center justify-center text-center py-8 text-white/40">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <ArrowRight className="w-5 h-5 text-white/30" />
              </div>
              <p className="text-[12px] max-w-[280px] leading-relaxed">
                Escolha pelo menos 1 carro para <span className="text-rose-200">vender</span> e 1 para <span className="text-emerald-200">comprar</span> para ver os números.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Hero delta */}
              <div className="md:col-span-4">
                <div className="text-[10.5px] uppercase tracking-wider text-white/50 mb-1">Diferença por dia</div>
                <div className={`text-4xl md:text-5xl font-light tabular-nums leading-none ${result.deltaPerDay >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  {fmtUSDsigned(result.deltaPerDay)}
                </div>
                <div className="text-[11px] text-white/45 tabular-nums mt-2">
                  Hoje {fmtUSD(result.outRev)}/dia → projetado {fmtUSD(result.outRev + result.deltaPerDay)}/dia
                </div>
              </div>

              {/* Projeções */}
              <div className="md:col-span-8 grid grid-cols-3 gap-2">
                {[
                  { label: "90 dias", value: result.delta90 },
                  { label: "6 meses", value: result.delta180 },
                  { label: "12 meses", value: result.delta365 },
                ].map(h => (
                  <div key={h.label} className="rounded-md bg-white/[0.04] border border-white/10 p-2.5">
                    <div className="text-[9.5px] uppercase tracking-wider text-white/45">{h.label}</div>
                    <div className={`text-[15px] md:text-[17px] font-medium tabular-nums leading-tight mt-1 ${h.value >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                      {fmtUSDsigned(h.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Detalhes */}
              <div className="md:col-span-12 rounded-lg bg-white/[0.03] border border-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/55">Uso médio — vendidos</span>
                  <span className="text-rose-200 tabular-nums">{result.outOcc.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/55">Uso médio — comprados</span>
                  <span className="text-emerald-200 tabular-nums">{result.inAvgOcc.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/55">Capital reciclado (venda)</span>
                  <span className="text-white/85 tabular-nums">{fmtUSD(result.outCapital)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/55">Capital p/ comprar</span>
                  <span className={`tabular-nums ${result.capitalDelta > 0 ? "text-amber-200" : "text-emerald-200"}`}>
                    {fmtUSD(result.inCapital)}
                    <span className="text-white/40 ml-1">({result.capitalDelta >= 0 ? "+" : "−"}{fmtUSD(Math.abs(result.capitalDelta))})</span>
                  </span>
                </div>
                {result.avgInPayback !== null && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/55">Payback médio da compra</span>
                    <span className="text-amber-200 tabular-nums">{result.avgInPayback.toFixed(0)} meses</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-white/55">Eficiência do capital</span>
                  <span className={`tabular-nums ${result.capitalEfficiency >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {result.capitalEfficiency >= 0 ? "+" : ""}{result.capitalEfficiency.toFixed(0)}%
                  </span>
                </div>
              </div>

              <p className="md:col-span-12 text-[10.5px] text-white/40 leading-relaxed">
                Cenário hipotético — assume que cada carro novo atinge a média histórica do grupo de referência. Apenas carros com 60+ dias de uso real estão disponíveis.
              </p>
            </div>
          )}
        </div>

        {eligible.length < 4 && (
          <p className="text-[11px] text-amber-200/70 mt-3">
            Você ainda tem poucos carros com 60+ dias de histórico ({eligible.length}). O simulador fica mais preciso conforme a frota acumula dados.
          </p>
        )}
      </div>
    </div>
  );
}
