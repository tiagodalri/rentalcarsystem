import { useMemo, useState } from "react";
import { useVehicleTrips, type VehicleTrip } from "@/hooks/useVehicleTrips";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, ChevronRight, MapPin, Gauge, Clock, Fuel, AlertTriangle, Activity } from "lucide-react";
import { LoadingRows } from "@/components/skeletons/LoadingRows";

// Fuso do veículo (frota em Orlando/FL). Garante que o horário exibido
// bata com o portal Bouncie e com o relógio do motorista — independente
// do fuso do navegador de quem está olhando.
const VEHICLE_TZ = "America/New_York";

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: VEHICLE_TZ,
  });
}
function fmtMi(v: number | null | undefined, d = 1): string {
  if (v == null) return "";
  return v.toFixed(d).replace(".", ",");
}
function fmtDuration(s: number | null | undefined): string {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m} min`;
}
// YYYY-MM-DD no fuso do veículo (sv-SE produz exatamente esse formato)
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: VEHICLE_TZ });
}
function dayHeader(key: string): string {
  // key = "YYYY-MM-DD" no fuso do veículo. Reconstruímos como meio-dia UTC
  // pra evitar qualquer drift de fuso no formatador.
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    })
    .toUpperCase();
}
function groupByDay(trips: VehicleTrip[]) {
  const map = new Map<string, VehicleTrip[]>();
  for (const t of trips) {
    if (!t.started_at) continue;
    const k = dayKey(t.started_at);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function TripsTab({ vehicleId }: { vehicleId: string }) {
  const { data: trips = [], isLoading, refetch } = useVehicleTrips(vehicleId, 30);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const grouped = useMemo(() => groupByDay(trips), [trips]);

  async function handleSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("bouncie-trips", {
        body: { vehicleId, days: 30 },
      });
      if (error) throw error;
      toast.success(`Sincronizado: ${data?.inserted ?? 0} viagens importadas`);
      await refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao sincronizar viagens", { description: e?.message });
    } finally {
      setSyncing(false);
    }
  }

  if (isLoading) {
    return <LoadingRows count={5} rowHeight={56} />;
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Viagens (últimos 30 dias)</h3>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Sincronizar
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-lg border border-dashed border-border/40">
          <Activity size={22} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs font-medium text-foreground">Sem viagens registradas</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Clique em <b>Sincronizar</b> para baixar o histórico da Bouncie.
          </p>
        </div>
      ) : (
        grouped.map(([day, dayTrips]) => {
          const total = dayTrips.reduce((s, t) => s + (t.distance_mi ?? 0), 0);
          return (
            <div key={day} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-medium tracking-wider text-muted-foreground">{dayHeader(day)}</span>
                <span className="text-[10px] font-semibold text-foreground tabular-nums">{fmtMi(total)} mi</span>
              </div>
              {dayTrips.map((t) => {
                const isOpen = expanded === t.id;
                return (
                  <div key={t.id} className="rounded-lg border border-border/30 bg-card/40 overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : t.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight size={12} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        <span className="text-xs text-foreground tabular-nums">
                          {fmtTime(t.started_at)}. {fmtTime(t.ended_at)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {fmtMi(t.distance_mi)} <span className="text-[9px] font-normal text-muted-foreground">mi</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/20 animate-in fade-in duration-150">
                        {/* Addresses */}
                        {(t.start_address || t.end_address) && (
                          <div className="space-y-1 text-[11px]">
                            {t.start_address && (
                              <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] uppercase font-medium text-muted-foreground">Início</p>
                                  <p className="text-foreground/80 truncate">{t.start_address}</p>
                                </div>
                              </div>
                            )}
                            {t.end_address && (
                              <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] uppercase font-medium text-muted-foreground">Fim</p>
                                  <p className="text-foreground/80 truncate">{t.end_address}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <Metric icon={<Clock size={11} />} label="Duração" value={fmtDuration(t.duration_seconds)} />
                          <Metric icon={<Activity size={11} />} label="Parado" value={fmtDuration(t.idle_seconds)} />
                          <Metric icon={<Gauge size={11} />} label="Vel. máx" value={t.max_speed_mph != null ? `${Math.round(t.max_speed_mph)} mph` : ""} />
                          <Metric icon={<Gauge size={11} />} label="Vel. média" value={t.avg_speed_mph != null ? `${Math.round(t.avg_speed_mph)} mph` : ""} />
                          <Metric icon={<Fuel size={11} />} label="Combustível" value={t.fuel_consumed_gal != null ? `${t.fuel_consumed_gal.toFixed(2)} gal` : ""} />
                          <Metric icon={<Fuel size={11} />} label="Consumo" value={t.average_mpg != null ? `${t.average_mpg.toFixed(1)} mpg` : ""} />
                          <Metric icon={<AlertTriangle size={11} />} label="Freadas" value={(t.hard_braking ?? 0).toString()} alert={!!t.hard_braking} />
                          <Metric icon={<AlertTriangle size={11} />} label="Acelerações" value={(t.hard_accel ?? 0).toString()} alert={!!t.hard_accel} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

function Metric({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-md px-2 py-1.5 ${alert ? "bg-red-500/10 border border-red-500/20" : "bg-muted/30 border border-border/20"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {icon}{label}
      </div>
      <p className={`text-xs font-medium tabular-nums mt-0.5 ${alert ? "text-red-500" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
