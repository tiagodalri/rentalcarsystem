import { useMemo } from "react";
import { X, Play, MapPin, Clock, Gauge, Loader2 } from "lucide-react";
import { useVehicleTrips, type VehicleTrip } from "@/hooks/useVehicleTrips";

const VEHICLE_TZ = "America/New_York";

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: VEHICLE_TZ,
  });
}
function fmtDur(s: number | null | undefined) {
  if (!s) return "—";
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

export function TripPickerDialog({ vehicleId, vehicleName, open, onClose, onPick }: Props) {
  const { data: trips = [], isLoading } = useVehicleTrips(vehicleId, 30, open);
  const grouped = useMemo(() => groupByDay(trips), [trips]);

  if (!open) return null;

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
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-bold">Replay de viagem</p>
            <h2 className="text-base font-bold text-white mt-0.5">{vehicleName}</h2>
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/50 text-xs gap-2">
              <Loader2 size={18} className="animate-spin" />
              Carregando viagens…
            </div>
          ) : grouped.length === 0 ? (
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
                      <span className="text-[10px] font-bold tracking-wider text-[#D4AF37]/80">
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
                                  {fmtTime(t.started_at)} – {fmtTime(t.ended_at)}
                                </p>
                                <p className="text-[10px] text-white/50 flex items-center gap-2 mt-0.5">
                                  <span className="flex items-center gap-1"><Clock size={9} />{fmtDur(t.duration_seconds)}</span>
                                  {t.max_speed_mph != null && (
                                    <span className="flex items-center gap-1"><Gauge size={9} />{Math.round(t.max_speed_mph)} mph</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-white tabular-nums shrink-0">
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
