import { useEffect, useMemo, useState } from "react";
import { X, Play, MapPin, Clock, Gauge, Loader2, Radio } from "lucide-react";
import { useVehicleTrips, type VehicleTrip } from "@/hooks/useVehicleTrips";
import { supabase } from "@/integrations/supabase/client";
import { LoadingRows } from "@/components/skeletons/LoadingRows";

const VEHICLE_TZ = "America/New_York";

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: VEHICLE_TZ,
  });
}
function fmtDur(s: number | null | undefined) {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m} min`;
}
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: VEHICLE_TZ });
}
function dayHeader(key: string) {
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

type Props = {
  vehicleId: string;
  vehicleName: string;
  open: boolean;
  onClose: () => void;
  onPick: (tripId: string) => void;
};

type LiveTripInfo = {
  startedAt: string;
  lastPointAt: string;
  points: number;
  lastSpeed: number | null;
};

/** Detects a trip in progress for the vehicle, from telemetry events/points. */
function useLiveTripDetect(vehicleId: string, enabled: boolean) {
  const [info, setInfo] = useState<LiveTripInfo | null>(null);
  useEffect(() => {
    if (!enabled || !vehicleId) { setInfo(null); return; }
    let cancelled = false;
    const fetchIt = async () => {
      try {
        // 1) Last tripStart and last tripEnd
        const [{ data: starts }, { data: ends }, { data: latestPt }] = await Promise.all([
          supabase
            .from("vehicle_telemetry_history")
            .select("reported_at")
            .eq("vehicle_id", vehicleId)
            .eq("event_type", "tripStart")
            .order("reported_at", { ascending: false })
            .limit(1),
          supabase
            .from("vehicle_telemetry_history")
            .select("reported_at")
            .eq("vehicle_id", vehicleId)
            .eq("event_type", "tripEnd")
            .order("reported_at", { ascending: false })
            .limit(1),
          supabase
            .from("vehicle_telemetry_history")
            .select("reported_at,speed")
            .eq("vehicle_id", vehicleId)
            .not("lat", "is", null)
            .order("reported_at", { ascending: false })
            .limit(1),
        ]);

        const lastStart = starts?.[0]?.reported_at ? new Date(starts[0].reported_at) : null;
        const lastEnd = ends?.[0]?.reported_at ? new Date(ends[0].reported_at) : null;
        const lastPtAt = latestPt?.[0]?.reported_at ? new Date(latestPt[0].reported_at) : null;
        const lastSpeed = latestPt?.[0]?.speed != null ? Number(latestPt[0].speed) : null;

        // A trip is "in progress" if: there's a tripStart with no tripEnd after it,
        // AND we've received at least one point in the last 15 min.
        const startActive = lastStart && (!lastEnd || lastEnd < lastStart);
        const recentPt = lastPtAt && Date.now() - lastPtAt.getTime() < 15 * 60 * 1000;
        if (cancelled) return;
        if (startActive && recentPt) {
          // Count points since start
          const { count } = await supabase
            .from("vehicle_telemetry_history")
            .select("id", { count: "exact", head: true })
            .eq("vehicle_id", vehicleId)
            .gte("reported_at", lastStart!.toISOString())
            .not("lat", "is", null);
          if (cancelled) return;
          setInfo({
            startedAt: lastStart!.toISOString(),
            lastPointAt: lastPtAt!.toISOString(),
            points: count ?? 0,
            lastSpeed,
          });
        } else {
          setInfo(null);
        }
      } catch {
        if (!cancelled) setInfo(null);
      }
    };
    fetchIt();
    const id = setInterval(fetchIt, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [vehicleId, enabled]);
  return info;
}

export function TripPickerDialog({ vehicleId, vehicleName, open, onClose, onPick }: Props) {
  const { data: trips = [], isLoading } = useVehicleTrips(vehicleId, 30, open);
  const grouped = useMemo(() => groupByDay(trips), [trips]);
  const live = useLiveTripDetect(vehicleId, open);

  if (!open) return null;

  const liveElapsedMin = live
    ? Math.max(0, Math.round((Date.now() - new Date(live.startedAt).getTime()) / 60000))
    : 0;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-primary/30 bg-[#0a0a0a] shadow-2xl shadow-primary/10 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: "rgba(212,175,55,0.35)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-medium">Replay de viagem</p>
            <h2 className="text-base font-medium text-white mt-0.5">{vehicleName}</h2>
            <p className="text-[11px] text-white/50 mt-0.5">Selecione uma viagem para reproduzir</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/70 hover:text-white"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* LIVE trip entry. always rendered on top when detected */}
          {live && (
            <button
              onClick={() => onPick(`live:${vehicleId}`)}
              className="w-full text-left rounded-xl border border-emerald-500/40 hover:border-emerald-400 bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.04] to-transparent transition-all px-3 py-3 mb-3 group relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Ao vivo
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 flex items-center justify-center transition-colors shrink-0">
                  <Radio size={16} className="text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Em andamento</p>
                  <p className="text-[11px] text-white/60 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock size={10} />{fmtTime(live.startedAt)} • há {liveElapsedMin} min
                    </span>
                    {live.lastSpeed != null && (
                      <span className="flex items-center gap-1 tabular-nums">
                        <Gauge size={10} />{Math.round(live.lastSpeed)} mph agora
                      </span>
                    )}
                    <span className="tabular-nums text-white/40">{live.points} pts</span>
                  </p>
                </div>
              </div>
            </button>
          )}

          {isLoading ? (
            <div className="py-4">
              <LoadingRows count={4} rowHeight={56} className="px-2" />
            </div>
          ) : grouped.length === 0 && !live ? (
            <div className="text-center py-12 px-4 text-white/60">
              <MapPin size={22} className="mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium">Sem viagens nos últimos 30 dias</p>
              <p className="text-[11px] mt-1 text-white/40">
                Sincronize as viagens na aba "Viagens" do veículo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([day, dayTrips]) => {
                const total = dayTrips.reduce((s, t) => s + (t.distance_mi ?? 0), 0);
                return (
                  <div key={day} className="space-y-1.5">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-medium tracking-wider text-[#D4AF37]/80">
                        {dayHeader(day)}
                      </span>
                      <span className="text-[10px] font-semibold text-white/60 tabular-nums">
                        {total.toFixed(1).replace(".", ",")} mi
                      </span>
                    </div>
                    {dayTrips.map((t) => {
                      return (
                        <button
                          key={t.id}
                          onClick={() => onPick(t.id)}
                          className="w-full text-left rounded-lg border border-white/10 hover:border-[#D4AF37]/40 bg-white/[0.02] hover:bg-[#D4AF37]/5 transition-all px-3 py-2.5 group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 group-hover:bg-[#D4AF37]/20 flex items-center justify-center transition-colors shrink-0">
                                <Play size={12} className="text-[#D4AF37] ml-0.5" fill="currentColor" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white tabular-nums">
                                  {fmtTime(t.started_at)}. {fmtTime(t.ended_at)}
                                </p>
                                <p className="text-[10px] text-white/50 flex items-center gap-2 mt-0.5">
                                  <span className="flex items-center gap-1"><Clock size={9} />{fmtDur(t.duration_seconds)}</span>
                                  {t.max_speed_mph != null && (
                                    <span className="flex items-center gap-1"><Gauge size={9} />{Math.round(t.max_speed_mph)} mph</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-white tabular-nums shrink-0">
                              {(t.distance_mi ?? 0).toFixed(1).replace(".", ",")}
                              <span className="text-[9px] font-normal text-white/40 ml-1">mi</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
