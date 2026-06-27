import { useEffect, useMemo, useState } from "react";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  Target, Zap, DollarSign, Activity, ArrowUpRight, ArrowDownRight,
  Gauge, Award, Flame, Snowflake, Layers, Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Booking = {
  id: string; status: string; pickup_date: string; return_date: string;
  total_price: number | null; vehicle_id: string | null; customer_name: string | null;
};
type Vehicle = {
  id: string; name: string | null; status: string | null; color: string | null;
  daily_price_usd: number | null; purchase_price: number | null;
  acquired_date: string | null; category: string | null;
  brand: string | null; model: string | null;
};
type Expense = { vehicle_id: string; amount: number; expense_date: string };

const fmtUSD = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export default function AiPainel({
  bookings, vehicles,
}: { bookings: Booking[]; vehicles: Vehicle[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("vehicle_expenses")
        .select("vehicle_id, amount, expense_date");
      setExpenses((data as Expense[]) || []);
    })();
  }, []);

  const today = useMemo(() => new Date(), []);
  const realBookings = bookings.filter(b => b.status !== "cancelled");

  /* ───── Per-vehicle analytics ───── */
  const perVehicle = useMemo(() => {
    return vehicles.map(v => {
      const vb = realBookings.filter(b => b.vehicle_id === v.id);
      const revenue = vb.reduce((s, b) => s + (Number(b.total_price) || 0), 0);
      const exp = expenses.filter(e => e.vehicle_id === v.id)
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const daysBooked = vb.reduce((s, b) => {
        const d = differenceInDays(new Date(b.return_date), new Date(b.pickup_date));
        return s + Math.max(d, 1);
      }, 0);
      const daysInFleet = v.acquired_date
        ? Math.max(differenceInDays(today, new Date(v.acquired_date)), 1)
        : 1;
      const occupancy = (daysBooked / daysInFleet) * 100;
      const purchase = Number(v.purchase_price) || 0;
      const profit = revenue - exp;
      const roi = purchase > 0 ? (profit / purchase) * 100 : 0;
      const revPerDayOwned = revenue / daysInFleet;
      const daily = Number(v.daily_price_usd) || 0;
      const paybackMonths = daily > 0 && purchase > 0
        ? Math.ceil(purchase / (daily * 20))
        : null;
      const customerCount = new Set(vb.map(b => b.customer_name).filter(Boolean)).size;
      return {
        v, revenue, exp, profit, daysBooked, daysInFleet, occupancy, roi,
        revPerDayOwned, paybackMonths, purchase, daily, customerCount,
        bookingsCount: vb.length,
      };
    });
  }, [vehicles, realBookings, expenses, today]);

  const fleetRevenue = perVehicle.reduce((s, p) => s + p.revenue, 0);
  const fleetExpenses = perVehicle.reduce((s, p) => s + p.exp, 0);
  const fleetInvested = perVehicle.reduce((s, p) => s + p.purchase, 0);
  const fleetROI = fleetInvested > 0 ? ((fleetRevenue - fleetExpenses) / fleetInvested) * 100 : 0;
  const avgOccupancy = perVehicle.length
    ? perVehicle.reduce((s, p) => s + p.occupancy, 0) / perVehicle.length : 0;

  /* ───── Rankings & insights ───── */
  const ranked = [...perVehicle].sort((a, b) => b.revPerDayOwned - a.revPerDayOwned);
  const topStars = ranked.slice(0, 3);
  const underperformers = [...perVehicle]
    .filter(p => p.daysInFleet > 60)
    .sort((a, b) => a.revPerDayOwned - b.revPerDayOwned)
    .slice(0, 3);

  const sellCandidates = perVehicle.filter(p =>
    p.daysInFleet > 180 && p.occupancy < 35 && (p.roi < 15 || p.purchase === 0 ? false : true)
  ).sort((a, b) => a.roi - b.roi).slice(0, 3);

  const priceUpCandidates = perVehicle.filter(p =>
    p.occupancy > 70 && p.bookingsCount >= 3
  ).sort((a, b) => b.occupancy - a.occupancy).slice(0, 3);

  /* ───── Category performance ───── */
  const byCategory = useMemo(() => {
    const map = new Map<string, { revenue: number; days: number; count: number }>();
    perVehicle.forEach(p => {
      const k = p.v.category || "—";
      const cur = map.get(k) || { revenue: 0, days: 0, count: 0 };
      cur.revenue += p.revenue;
      cur.days += p.daysInFleet;
      cur.count += 1;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({ cat, ...v, rpd: v.days ? v.revenue / v.days : 0 }))
      .sort((a, b) => b.rpd - a.rpd);
  }, [perVehicle]);

  /* ───── Monthly trend (last 6 months) ───── */
  const monthlyTrend = useMemo(() => {
    const out: { label: string; revenue: number; bookings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const anchor = startOfMonth(subMonths(today, i));
      const end = endOfMonth(anchor);
      const inM = realBookings.filter(b => {
        const d = new Date(b.pickup_date);
        return d >= anchor && d <= end;
      });
      out.push({
        label: format(anchor, "MMM", { locale: ptBR }),
        revenue: inM.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
        bookings: inM.length,
      });
    }
    return out;
  }, [realBookings, today]);
  const maxBar = Math.max(...monthlyTrend.map(m => m.revenue), 1);

  /* ───── Cash projection: next 30d confirmed ───── */
  const next30 = useMemo(() => {
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);
    return realBookings
      .filter(b => {
        const d = new Date(b.pickup_date);
        return d >= today && d <= horizon;
      })
      .reduce((s, b) => s + (Number(b.total_price) || 0), 0);
  }, [realBookings, today]);

  /* ───── Top customers ───── */
  const topCustomers = useMemo(() => {
    const map = new Map<string, { revenue: number; trips: number }>();
    realBookings.forEach(b => {
      const name = b.customer_name || "—";
      const cur = map.get(name) || { revenue: 0, trips: 0 };
      cur.revenue += Number(b.total_price) || 0;
      cur.trips += 1;
      map.set(name, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [realBookings]);

  /* ───── Brand performance ───── */
  const byBrand = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number; occupancy: number }>();
    perVehicle.forEach(p => {
      const k = p.v.brand || p.v.name?.split(" ")[0] || "—";
      const cur = map.get(k) || { revenue: 0, count: 0, occupancy: 0 };
      cur.revenue += p.revenue;
      cur.count += 1;
      cur.occupancy += p.occupancy;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([brand, v]) => ({ brand, ...v, avgOcc: v.occupancy / v.count }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [perVehicle]);

  return (
    <div className="ai-shell relative -mx-4 lg:-mx-6 -mt-3 lg:-mt-6 px-4 lg:px-8 pt-6 pb-10 min-h-[calc(100vh-120px)]">
      {/* Cosmic background */}
      <div className="ai-bg-grid" />
      <div className="ai-bg-glow" />
      <div className="ai-bg-noise" />

      <div className="relative z-10 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="ai-badge">
                <Sparkles size={11} strokeWidth={2} />
                <span>IA ATIVADA</span>
                <span className="ai-pulse" />
              </div>
            </div>
            <h1 className="ai-title">Cockpit Inteligente</h1>
            <p className="ai-subtitle">
              Análise preditiva da frota · {perVehicle.length} veículos · {realBookings.length} reservas processadas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="ai-chip">
              <Brain size={12} />
              <span>Neural v2.6</span>
            </div>
          </div>
        </div>

        {/* Hero KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AiKpi label="Receita histórica" value={fmtUSD(fleetRevenue)} icon={DollarSign} hue="amber" />
          <AiKpi label="ROI da frota" value={`${fleetROI.toFixed(1)}%`} icon={Target} hue={fleetROI >= 0 ? "emerald" : "rose"} />
          <AiKpi label="Ocupação média" value={`${avgOccupancy.toFixed(1)}%`} icon={Gauge} hue="cyan" />
          <AiKpi label="Pipeline 30d" value={fmtUSD(next30)} icon={Rocket} hue="violet" />
        </div>

        {/* Recommendations: 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <RecCard
            title="Candidatos a venda"
            subtitle="Baixa ocupação + ROI fraco há +6 meses"
            icon={AlertTriangle}
            hue="rose"
            empty="Nenhum veículo nesse perfil."
            items={sellCandidates.map(p => ({
              name: p.v.name || "—",
              right: `${p.occupancy.toFixed(0)}% ocup`,
              sub: `ROI ${p.roi.toFixed(1)}% · ${p.daysInFleet}d na frota`,
            }))}
          />
          <RecCard
            title="Subir preço"
            subtitle="Demanda quente, margem na mesa"
            icon={Flame}
            hue="amber"
            empty="Sem demanda excedente identificada."
            items={priceUpCandidates.map(p => ({
              name: p.v.name || "—",
              right: `${p.occupancy.toFixed(0)}%`,
              sub: `Diária atual ${fmtUSD(p.daily)} · sugestão +12% a +18%`,
            }))}
          />
          <RecCard
            title="Estrelas da frota"
            subtitle="Maior receita por dia possuído"
            icon={Award}
            hue="emerald"
            empty="Acumule mais histórico."
            items={topStars.map(p => ({
              name: p.v.name || "—",
              right: fmtUSD(p.revPerDayOwned) + "/d",
              sub: `${p.bookingsCount} reservas · ${p.customerCount} clientes`,
            }))}
          />
        </div>

        {/* Trend + Category */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="ai-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="ai-card-title">Pulso de receita · últimos 6 meses</h3>
                <p className="ai-card-sub">Tendência operacional efetiva</p>
              </div>
              <Activity size={14} className="text-cyan-300/70" />
            </div>
            <div className="flex items-end gap-3 h-40">
              {monthlyTrend.map((m, i) => {
                const h = (m.revenue / maxBar) * 100;
                const isMax = m.revenue === maxBar && m.revenue > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-[10px] tabular-nums text-white/60">{fmtUSD(m.revenue)}</div>
                    <div className="w-full relative" style={{ height: "120px" }}>
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all ${
                          isMax ? "ai-bar-hot" : "ai-bar"
                        }`}
                        style={{ height: `${Math.max(h, 4)}%` }}
                      />
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-white/50">{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ai-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="ai-card-title">Categoria mais rentável</h3>
                <p className="ai-card-sub">Receita por dia possuído</p>
              </div>
              <Layers size={14} className="text-violet-300/70" />
            </div>
            <ul className="space-y-2.5">
              {byCategory.slice(0, 5).map(c => (
                <li key={c.cat} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-white/85 truncate">{c.cat}</span>
                  <span className="tabular-nums text-amber-200/90">{fmtUSD(c.rpd)}/d</span>
                </li>
              ))}
              {byCategory.length === 0 && <li className="text-white/50 text-xs">Sem dados.</li>}
            </ul>
          </div>
        </div>

        {/* Underperformers + Brand + Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="ai-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="ai-card-title">Veículos em ponto de alerta</h3>
                <p className="ai-card-sub">Receita/dia abaixo do esperado</p>
              </div>
              <Snowflake size={14} className="text-rose-300/70" />
            </div>
            <ul className="space-y-2.5">
              {underperformers.map(p => (
                <li key={p.v.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="text-white/90 truncate">{p.v.name}</div>
                    <div className="text-[10.5px] text-white/50">{p.occupancy.toFixed(0)}% ocup · {p.daysInFleet}d</div>
                  </div>
                  <span className="tabular-nums text-rose-300/90">{fmtUSD(p.revPerDayOwned)}/d</span>
                </li>
              ))}
              {underperformers.length === 0 && <li className="text-white/50 text-xs">Frota equilibrada.</li>}
            </ul>
          </div>

          <div className="ai-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="ai-card-title">Marcas que mais entregam</h3>
                <p className="ai-card-sub">Receita acumulada</p>
              </div>
              <TrendingUp size={14} className="text-emerald-300/70" />
            </div>
            <ul className="space-y-2.5">
              {byBrand.slice(0, 5).map(b => (
                <li key={b.brand} className="text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/85 truncate">{b.brand}</span>
                    <span className="tabular-nums text-emerald-200/90">{fmtUSD(b.revenue)}</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full ai-bar-emerald" style={{ width: `${Math.min(b.avgOcc, 100)}%` }} />
                  </div>
                </li>
              ))}
              {byBrand.length === 0 && <li className="text-white/50 text-xs">Sem dados.</li>}
            </ul>
          </div>

          <div className="ai-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="ai-card-title">Clientes de alto valor</h3>
                <p className="ai-card-sub">Top 5 por receita acumulada</p>
              </div>
              <Zap size={14} className="text-amber-300/70" />
            </div>
            <ul className="space-y-2.5">
              {topCustomers.map((c, i) => (
                <li key={c.name + i} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="text-white/90 truncate">{c.name}</div>
                    <div className="text-[10.5px] text-white/50">{c.trips} reservas</div>
                  </div>
                  <span className="tabular-nums text-amber-200/90">{fmtUSD(c.revenue)}</span>
                </li>
              ))}
              {topCustomers.length === 0 && <li className="text-white/50 text-xs">Sem dados.</li>}
            </ul>
          </div>
        </div>

        {/* AI insight banner */}
        <div className="ai-insight">
          <div className="flex items-start gap-3">
            <div className="ai-insight-icon"><Brain size={16} /></div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-1">Insight executivo</div>
              <p className="text-[13.5px] text-white/90 leading-relaxed">
                {buildExecutiveInsight({ fleetROI, avgOccupancy, sellCandidates, priceUpCandidates, topStars, byCategory })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped styles */}
      <style>{`
        .ai-shell {
          background: radial-gradient(ellipse at top, #0b1830 0%, #050813 55%, #02030a 100%);
          color: #e6f0ff;
          isolation: isolate;
        }
        .ai-bg-grid {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(120,180,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,180,255,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
        }
        .ai-bg-glow {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(600px circle at 20% 10%, rgba(80,140,255,0.25), transparent 60%),
            radial-gradient(500px circle at 85% 15%, rgba(180,90,255,0.18), transparent 60%),
            radial-gradient(700px circle at 60% 90%, rgba(20,200,200,0.15), transparent 60%);
        }
        .ai-bg-noise {
          position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .035;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
        }
        .ai-title {
          font-size: clamp(28px, 3vw, 38px); font-weight: 200; letter-spacing: -0.02em;
          background: linear-gradient(135deg, #ffffff 0%, #aac8ff 60%, #d4a8ff 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          line-height: 1.05;
        }
        .ai-subtitle { font-size: 12.5px; color: rgba(230,240,255,0.55); margin-top: 6px; }
        .ai-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 10px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(80,140,255,0.18), rgba(180,90,255,0.18));
          border: 1px solid rgba(120,180,255,0.35);
          font-size: 10px; letter-spacing: 0.22em; font-weight: 600;
          color: #c7e0ff;
        }
        .ai-pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: #5cffb0; box-shadow: 0 0 10px #5cffb0;
          animation: ai-pulse 1.6s ease-in-out infinite;
        }
        @keyframes ai-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        .ai-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 999px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          font-size: 10.5px; color: rgba(230,240,255,0.7);
        }
        .ai-card {
          position: relative;
          padding: 18px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(20,30,55,0.55), rgba(10,15,30,0.55));
          border: 1px solid rgba(120,180,255,0.12);
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6);
        }
        .ai-card::before {
          content: ""; position: absolute; inset: 0; border-radius: 16px; pointer-events: none;
          background: linear-gradient(135deg, rgba(120,180,255,0.18), transparent 40%);
          mask: linear-gradient(black, black) content-box, linear-gradient(black, black);
          mask-composite: exclude; -webkit-mask-composite: xor;
          padding: 1px;
        }
        .ai-card-title { font-size: 13px; font-weight: 500; color: #eaf2ff; letter-spacing: -0.005em; }
        .ai-card-sub { font-size: 10.5px; color: rgba(230,240,255,0.5); margin-top: 2px; }
        .ai-bar { background: linear-gradient(180deg, rgba(120,180,255,0.9), rgba(60,100,200,0.5)); box-shadow: 0 0 18px rgba(120,180,255,0.4); }
        .ai-bar-hot { background: linear-gradient(180deg, #ffd27a, #ff7a5c); box-shadow: 0 0 22px rgba(255,170,90,0.55); }
        .ai-bar-emerald { background: linear-gradient(90deg, rgba(92,255,176,0.9), rgba(60,200,140,0.4)); }
        .ai-insight {
          padding: 16px 18px; border-radius: 14px;
          background: linear-gradient(135deg, rgba(40,80,180,0.25), rgba(120,40,180,0.18));
          border: 1px solid rgba(120,180,255,0.25);
        }
        .ai-insight-icon {
          width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center;
          background: linear-gradient(135deg, rgba(120,180,255,0.4), rgba(180,120,255,0.4));
          color: #fff; box-shadow: 0 0 18px rgba(120,180,255,0.45);
        }
      `}</style>
    </div>
  );
}

/* ───── KPI ───── */
function AiKpi({
  label, value, icon: Icon, hue,
}: { label: string; value: string; icon: typeof Brain; hue: "amber"|"emerald"|"cyan"|"violet"|"rose" }) {
  const hueMap = {
    amber:   { txt: "text-amber-200",   glow: "rgba(255,180,80,0.35)"   },
    emerald: { txt: "text-emerald-200", glow: "rgba(92,255,176,0.35)"   },
    cyan:    { txt: "text-cyan-200",    glow: "rgba(120,220,255,0.35)"  },
    violet:  { txt: "text-violet-200",  glow: "rgba(200,140,255,0.35)"  },
    rose:    { txt: "text-rose-200",    glow: "rgba(255,140,160,0.35)"  },
  }[hue];
  return (
    <div className="ai-card" style={{ boxShadow: `0 20px 60px -30px ${hueMap.glow}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/55">{label}</span>
        <Icon size={13} className={hueMap.txt} />
      </div>
      <div className={`text-3xl font-light tabular-nums ${hueMap.txt}`} style={{ textShadow: `0 0 24px ${hueMap.glow}` }}>
        {value}
      </div>
    </div>
  );
}

/* ───── Recommendation card ───── */
function RecCard({
  title, subtitle, icon: Icon, hue, items, empty,
}: {
  title: string; subtitle: string; icon: typeof Brain;
  hue: "rose"|"amber"|"emerald";
  items: { name: string; right: string; sub: string }[]; empty: string;
}) {
  const c = {
    rose:    { i: "text-rose-300",    a: "text-rose-200/90"    },
    amber:   { i: "text-amber-300",   a: "text-amber-200/90"   },
    emerald: { i: "text-emerald-300", a: "text-emerald-200/90" },
  }[hue];
  return (
    <div className="ai-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="ai-card-title">{title}</h3>
          <p className="ai-card-sub">{subtitle}</p>
        </div>
        <Icon size={14} className={c.i} />
      </div>
      {items.length === 0 ? (
        <p className="text-white/50 text-xs">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/90 truncate">{it.name}</span>
                <span className={`tabular-nums ${c.a}`}>{it.right}</span>
              </div>
              <div className="text-[10.5px] text-white/50 mt-0.5">{it.sub}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───── Executive insight string ───── */
function buildExecutiveInsight({
  fleetROI, avgOccupancy, sellCandidates, priceUpCandidates, topStars, byCategory,
}: any): string {
  const parts: string[] = [];
  if (avgOccupancy < 40) {
    parts.push(`Ocupação média em ${avgOccupancy.toFixed(0)}% sinaliza capacidade ociosa — priorize ativação de demanda antes de expandir frota.`);
  } else if (avgOccupancy > 70) {
    parts.push(`Frota operando a ${avgOccupancy.toFixed(0)}% de ocupação: janela ideal para reprecificar para cima e estudar novas aquisições.`);
  } else {
    parts.push(`Ocupação saudável em ${avgOccupancy.toFixed(0)}% — operação estável com espaço para otimização cirúrgica.`);
  }
  if (sellCandidates.length > 0) {
    parts.push(`${sellCandidates.length} veículo(s) com ROI < 15% e baixa rotação são candidatos a troca por modelos mais performáticos.`);
  }
  if (priceUpCandidates.length > 0) {
    parts.push(`${priceUpCandidates.length} veículo(s) acima de 70% de ocupação suportam aumento de diária entre 12% e 18% sem perda relevante de demanda.`);
  }
  if (topStars[0]) {
    parts.push(`${topStars[0].v.name} é o maior gerador de receita por dia possuído — considere replicar o perfil em novas aquisições.`);
  }
  if (byCategory[0]) {
    parts.push(`Categoria ${byCategory[0].cat} entrega ${fmtUSD(byCategory[0].rpd)}/dia, a mais rentável da frota.`);
  }
  parts.push(`ROI consolidado atual: ${fleetROI.toFixed(1)}%.`);
  return parts.join(" ");
}
