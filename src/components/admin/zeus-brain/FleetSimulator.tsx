import { useMemo, useState } from "react";
import { Gamepad2, X, ArrowRight, Sparkles, TrendingUp, TrendingDown, Trophy, Search, ShoppingCart, Tag } from "lucide-react";
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
  const [queryOut, setQueryOut] = useState("");
  const [queryIn, setQueryIn] = useState("");

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

  // Totalizadores ao vivo (independentes do resultado completo)
  const sellCapitalLive = outList.reduce((s, p) => s + (p.purchase || 0), 0);
  const buyCapitalLive = inList.reduce((s, p) => s + (p.purchase || 0), 0);
  const balanceLive = sellCapitalLive - buyCapitalLive;


  const result = useMemo(() => {
    if (!outList.length || !inList.length) return null;
    const outRev = outList.reduce((s, p) => s + p.revPerDayOwned, 0);
    const outOcc = outList.reduce((s, p) => s + p.occupancy, 0) / outList.length;
    const outCapital = outList.reduce((s, p) => s + p.purchase, 0);
    const inAvgRev = inList.reduce((s, p) => s + p.revPerDayOwned, 0) / inList.length;
    const inAvgOcc = inList.reduce((s, p) => s + p.occupancy, 0) / inList.length;
    const inCapital = inList.reduce((s, p) => s + p.purchase, 0) / inList.length * outList.length;

    const projectedRevPerDay = inAvgRev * outList.length;
    const deltaPerDay = projectedRevPerDay - outRev;

    const inPayback = inList.filter(p => p.paybackMonths !== null).map(p => p.paybackMonths!);
    const avgInPayback = inPayback.length ? inPayback.reduce((s, x) => s + x, 0) / inPayback.length : null;

    return {
      outRev, outOcc, outCapital,
      inAvgRev, inAvgOcc, inCapital,
      deltaPerDay,
      delta90: deltaPerDay * 90,
      delta180: deltaPerDay * 180,
      delta365: deltaPerDay * 365,
      capitalDelta: inCapital - outCapital,
      capitalEfficiency: outCapital > 0 ? ((projectedRevPerDay / inCapital) / (outRev / outCapital) - 1) * 100 : 0,
      avgInPayback,
      count: outList.length,
    };
  }, [outList, inList]);

  const toggleOut = (id: string) =>
    setOutIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleIn = (id: string) =>
    setInIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const reset = () => { setOutIds([]); setInIds([]); };

  return (
    <div className="ai-card relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-cyan-400/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-fuchsia-400/10 blur-3xl pointer-events-none" />
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-cyan-300" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Simulador Inteligente</span>
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
        <h3 className="text-lg md:text-xl font-light text-white leading-snug mb-1">
          Renovação de Frota
        </h3>
        <p className="text-[12px] text-white/55 mb-4 leading-relaxed max-w-3xl">
          Escolha quais carros <span className="text-rose-200">vender</span> e quais <span className="text-emerald-200">comprar</span> (como referência de desempenho). A IA projeta o impacto financeiro assumindo que os novos carros vão render igual à média do grupo escolhido.
        </p>

        {/* Duas colunas: VENDER | COMPRAR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* VENDER */}
          <div className="rounded-xl bg-rose-500/[0.04] border border-rose-400/20 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-rose-500/15 border border-rose-400/30 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5 text-rose-200" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-rose-100 font-medium leading-none">Vender</div>
                  <div className="text-[10px] text-white/45 mt-0.5">Carros que saem da frota</div>
                </div>
              </div>
              <span className="text-[10px] text-white/40 tabular-nums">{outList.length} selecionado{outList.length === 1 ? "" : "s"}</span>
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
          <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-400/20 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-200" />
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wider text-emerald-100 font-medium leading-none">Comprar</div>
                  <div className="text-[10px] text-white/45 mt-0.5">Referência de desempenho da nova frota</div>
                </div>
              </div>
              <span className="text-[10px] text-white/40 tabular-nums">{inList.length} selecionado{inList.length === 1 ? "" : "s"}</span>
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
