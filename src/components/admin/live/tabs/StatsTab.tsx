import { useMemo } from "react";
import { useVehicleTrips } from "@/hooks/useVehicleTrips";

function fmtNum(v: number, d = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtHrs(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function StatsTab({ vehicleId }: { vehicleId: string }) {
  const { data: trips = [], isLoading } = useVehicleTrips(vehicleId, 30);

  const stats = useMemo(() => {
    const n = trips.length;
    if (n === 0) return null;
    const sum = (k: keyof typeof trips[0]) => trips.reduce((s, t) => s + ((t[k] as number) ?? 0), 0);
    const dist = sum("distance_mi");
    const time = sum("duration_seconds");
    const idle = sum("idle_seconds");
    const fuel = sum("fuel_consumed_gal");
    const hb = sum("hard_braking");
    const ha = sum("hard_accel");
    const speeds = trips.map((t) => t.max_speed_mph ?? 0).filter((v) => v > 0);
    const avgs = trips.map((t) => t.avg_speed_mph ?? 0).filter((v) => v > 0);
    const peak = speeds.length ? Math.max(...speeds) : 0;
    const avgMoving = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    const mpg = fuel > 0 ? dist / fuel : 0;
    return {
      n, dist, time, idle, fuel, mpg, hb, ha, peak, avgMoving,
      avgDist: dist / n, avgTime: time / n, avgIdle: idle / n, avgFuel: fuel / n, avgHb: hb / n, avgHa: ha / n,
    };
  }, [trips]);

  if (isLoading) {
    return <div className="p-6 text-center text-xs text-muted-foreground">Calculando estatísticas…</div>;
  }
  if (!stats) {
    return <div className="p-6 text-center text-xs text-muted-foreground">Sem dados suficientes nos últimos 30 dias.</div>;
  }

  return (
    <div className="p-3 space-y-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        Últimos 30 dias • {stats.n} viagens
      </p>

      <Group title="Direção">
        <Row label="Distância total" value={`${fmtNum(stats.dist, 1)} mi`} avg={`${fmtNum(stats.avgDist, 1)} mi/viagem`} />
        <Row label="Tempo dirigindo" value={fmtHrs(stats.time)} avg={`${fmtHrs(stats.avgTime)} /viagem`} />
        <Row label="Tempo parado" value={fmtHrs(stats.idle)} avg={`${fmtHrs(stats.avgIdle)} /viagem`} />
      </Group>

      <Group title="Combustível">
        <Row label="Consumido" value={`${fmtNum(stats.fuel, 2)} gal`} avg={`${fmtNum(stats.avgFuel, 2)} gal/viagem`} />
        <Row label="Consumo médio" value={`${fmtNum(stats.mpg, 1)} mpg`} />
      </Group>

      <Group title="Velocidade">
        <Row label="Vel. média (mov.)" value={`${Math.round(stats.avgMoving)} mph`} />
        <Row label="Pico de velocidade" value={`${Math.round(stats.peak)} mph`} />
      </Group>

      <Group title="Hábitos de direção">
        <Row label="Freadas bruscas" value={fmtNum(stats.hb)} avg={`${stats.avgHb.toFixed(2)} /viagem`} alert={stats.hb > 0} />
        <Row label="Acelerações bruscas" value={fmtNum(stats.ha)} avg={`${stats.avgHa.toFixed(2)} /viagem`} alert={stats.ha > 0} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-foreground px-1">{title}</h4>
      <div className="rounded-lg border border-border/30 bg-card/40 divide-y divide-border/20">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, avg, alert }: { label: string; value: string; avg?: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className={`text-sm font-bold tabular-nums ${alert ? "text-red-500" : "text-foreground"}`}>{value}</p>
        {avg && <p className="text-[10px] text-muted-foreground/70 tabular-nums">{avg}</p>}
      </div>
    </div>
  );
}
