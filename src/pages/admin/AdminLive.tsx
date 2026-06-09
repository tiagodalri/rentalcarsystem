import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Signal, Gauge, Clock, MapPin, Activity, X, ChevronRight, Play, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCoverImage } from "@/data/vehicleImages";
import { useFleetLive, type LiveVehicle } from "@/hooks/useFleetLive";
import { supabase } from "@/integrations/supabase/client";
import { UnlinkedBouncieDevices } from "@/components/admin/UnlinkedBouncieDevices";
import { GoogleFleetMap } from "@/components/admin/GoogleFleetMap";
import { VehicleDetailDrawer } from "@/components/admin/live/VehicleDetailDrawer";
import { MapControlsPanel, useMapLayers } from "@/components/admin/live/MapControlsPanel";
import { TripPickerDialog } from "@/components/admin/live/TripPickerDialog";
import { TripReplayOverlay } from "@/components/admin/live/TripReplayOverlay";
import zeusZMark from "@/assets/zeus-z-mark.png";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0 || Number.isNaN(diff)) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

const SPEED_BANDS = [
  { label: "0-35 mph", color: "#f59e0b" },
  { label: "35-45 mph", color: "#22c55e" },
  { label: "45-50 mph", color: "#3b82f6" },
  { label: "50-65 mph", color: "#ec4899" },
  { label: "65+ mph", color: "#ef4444" },
];

export default function AdminLive() {
  const { vehicles, loading } = useFleetLive();
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "moving" | "idle" | "parked">("all");
  const [layers, setLayers] = useMapLayers();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replayTripId, setReplayTripId] = useState<string | null>(null);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const navigate = useNavigate();

  const onMap = useMemo(
    () => vehicles.filter((v) => v.lat !== null && v.lng !== null),
    [vehicles]
  );

  const filtered = useMemo(
    () => onMap.filter((v) => filter === "all" || v.status === filter),
    [onMap, filter]
  );

  const selectedVehicle = vehicles.find((v) => v.vehicle_id === selected) ?? null;

  const stats = useMemo(() => {
    const moving = onMap.filter((v) => v.status === "moving");
    return {
      total: onMap.length,
      moving: moving.length,
      idle: onMap.filter((v) => v.status === "idle").length,
      parked: onMap.filter((v) => v.status === "parked").length,
      avgSpeed: moving.length
        ? Math.round(moving.reduce((s, v) => s + (v.speed ?? 0), 0) / moving.length)
        : 0,
    };
  }, [onMap]);

  const noTelemetry = !loading && onMap.length === 0;

  async function handleRunHistoricalBackfill() {
    setRunningBackfill(true);
    try {
      const { data, error } = await supabase.functions.invoke("bouncie-backfill", {
        body: { manual: true, weeksPerVehicle: 2, vehiclesPerRun: 2, maxRunSeconds: 45 },
      });
      if (error) throw error;
      toast.success("Backfill histórico iniciado", {
        description: data?.all_done ? "Todos os veículos já estão concluídos." : `${data?.processed ?? 0} veículos processados nesta rodada.`,
      });
    } catch (e: any) {
      toast.error("Falha ao rodar backfill histórico", { description: e?.message });
    } finally {
      setRunningBackfill(false);
    }
  }

  return (
    <div className="space-y-4 lg:h-[calc(100dvh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
            <Signal size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Zeus Live Tracking
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Telemetria Bouncie em tempo real • Google Maps</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            onClick={handleRunHistoricalBackfill}
            disabled={runningBackfill}
            className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-muted/30 disabled:opacity-50"
          >
            {runningBackfill ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
            Backfill histórico
          </button>
          <Clock size={12} />
          {new Date().toLocaleTimeString("pt-BR")}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-foreground", bg: "bg-muted/30" },
          { label: "Em movimento", value: stats.moving, color: "text-green-500", bg: "bg-green-500/10" },
          { label: "Parados", value: stats.idle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
          { label: "Estacionados", value: stats.parked, color: "text-muted-foreground", bg: "bg-muted/20" },
          { label: "Vel. Média", value: `${stats.avgSpeed} mph`, color: "text-primary", bg: "bg-primary/10" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg px-3 py-2 border border-border/30`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 lg:h-[calc(100%-8rem)]">
        {/* Vehicle list sidebar */}
        <div className="w-full lg:w-72 lg:shrink-0 flex flex-col gap-2 lg:overflow-hidden">
          <UnlinkedBouncieDevices />

          <div className="flex flex-wrap gap-1.5">
            {(["all", "moving", "idle", "parked"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  filter === f
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "moving" ? "Movendo" : f === "idle" ? "Parado" : "Estacionado"}
              </button>
            ))}
          </div>

          <div className="lg:flex-1 lg:overflow-y-auto space-y-1.5 lg:pr-1 scrollbar-thin">
            {loading ? (
              <div className="text-xs text-muted-foreground p-4 text-center">Carregando telemetria…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={noTelemetry ? "Sem telemetria ainda" : "Nenhum veículo neste filtro"}
                description={
                  noTelemetry
                    ? "Cadastre o IMEI Bouncie em cada veículo e aguarde os primeiros eventos do rastreador."
                    : "Ajuste o filtro acima para ver outros veículos."
                }
                compact
              />
            ) : (
              filtered.map((v) => (
                <button
                  key={v.vehicle_id}
                  onClick={() => setSelected(v.vehicle_id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                    selected === v.vehicle_id
                      ? "bg-primary/5 border-primary/40 shadow-sm shadow-primary/10"
                      : "bg-card/50 border-border/30 hover:border-border/60 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getCoverImage(v.name)}
                      alt={v.name}
                      className="w-12 h-9 rounded object-cover flex-shrink-0 border border-border/20"
                      loading="lazy"
                      width={48}
                      height={36}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-semibold text-foreground truncate">{v.name}</span>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            v.status === "moving"
                              ? "bg-green-500"
                              : v.status === "idle"
                              ? "bg-yellow-500"
                              : "bg-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono">{v.plate ?? "—"}</span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Gauge size={10} />
                          {Math.round(v.speed ?? 0)} mph
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border/40 relative h-[60vh] lg:h-auto min-h-[400px]">
          <div className="absolute top-3 left-3 z-[1000] w-10 h-10 rounded-lg bg-background/95 backdrop-blur-sm border border-border/40 shadow-md flex items-center justify-center pointer-events-none">
            <img src={zeusZMark} alt="Zeus" width={24} height={24} className="w-6 h-6 object-contain" />
          </div>

          {/* Map controls (settings button + popup panel) */}
          <div className="absolute top-3 right-3 z-[1000]">
            <MapControlsPanel layers={layers} onChange={setLayers} />
          </div>

          {/* Speed bands legend */}
          {layers.speedLegend && selectedVehicle && (
            <div className="absolute top-16 right-3 z-[1000] bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Speed bands</p>
              <div className="space-y-1">
                {SPEED_BANDS.map((b) => (
                  <div key={b.label} className="flex items-center gap-2 text-[10px] text-foreground/80">
                    <span className="w-3 h-1 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="tabular-nums">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noTelemetry && (
            <div className="absolute inset-0 z-[900] flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="max-w-sm text-center px-6 py-8 rounded-xl border border-border/40 bg-card/90">
                <Activity size={28} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground">Sem telemetria recebida</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Vincule o IMEI Bouncie de cada veículo na ficha do carro. Os eventos do rastreador aparecerão aqui em tempo real.
                </p>
              </div>
            </div>
          )}

          <GoogleFleetMap
            vehicles={filtered}
            selectedId={selected}
            onSelect={setSelected}
            onOpen={(id) => navigate(`/admin/fleet/${id}`)}
            layers={layers}
          />

          {/* Compact preview card (only when drawer is closed) */}
          {selectedVehicle && !drawerOpen && (
            <div className="absolute bottom-3 right-3 z-[1000] bg-background/95 backdrop-blur-md rounded-xl border border-border/40 w-72 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="relative">
                <img
                  src={getCoverImage(selectedVehicle.name)}
                  alt={selectedVehicle.name}
                  className="w-full h-24 object-cover bg-muted"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Fechar"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 flex items-center justify-center hover:bg-background transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm leading-tight truncate">{selectedVehicle.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedVehicle.plate ?? "—"}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      selectedVehicle.status === "moving"
                        ? "bg-green-500/10 text-green-500"
                        : selectedVehicle.status === "idle"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {selectedVehicle.status === "moving" ? "Movendo" : selectedVehicle.status === "idle" ? "Parado" : "Estacionado"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2.5">
                  <div className="rounded-md bg-muted/30 px-2 py-1.5 border border-border/20">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Gauge size={10} />Velocidade</p>
                    <p className="font-bold text-foreground tabular-nums">{Math.round(selectedVehicle.speed ?? 0)} mph</p>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5 border border-border/20">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Clock size={10} />Atualizado</p>
                    <p className="font-bold text-foreground">{formatRelative(selectedVehicle.reported_at)}</p>
                  </div>
                </div>
                {selectedVehicle.address && (
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-snug mb-2.5">
                    <MapPin size={11} className="text-primary mt-0.5 shrink-0" />
                    <span className="truncate">{selectedVehicle.address}</span>
                  </p>
                )}
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg gold-gradient text-primary-foreground hover:opacity-90 transition-opacity py-2 text-xs font-bold"
                >
                  Ver detalhes completos <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors py-1.5 text-[11px] font-bold uppercase tracking-wider"
                >
                  <Play size={11} fill="currentColor" /> Reproduzir viagem
                </button>
              </div>
            </div>
          )}

          {/* Full detail drawer */}
          {selectedVehicle && drawerOpen && (
            <VehicleDetailDrawer
              vehicle={selectedVehicle}
              onClose={() => setDrawerOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Trip picker + replay overlay */}
      {selectedVehicle && (
        <TripPickerDialog
          vehicleId={selectedVehicle.vehicle_id}
          vehicleName={selectedVehicle.name}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(tripId) => {
            setPickerOpen(false);
            setReplayTripId(tripId);
          }}
        />
      )}
      {selectedVehicle && replayTripId && (
        <TripReplayOverlay
          vehicleId={selectedVehicle.vehicle_id}
          vehicleName={selectedVehicle.name}
          tripId={replayTripId}
          onClose={() => setReplayTripId(null)}
        />
      )}
    </div>
  );
}
