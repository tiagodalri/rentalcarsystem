import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Signal, Battery, Gauge, Clock, MapPin, ExternalLink, Fuel, AlertTriangle, Activity } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCoverImage } from "@/data/vehicleImages";
import { useFleetLive, type LiveVehicle } from "@/hooks/useFleetLive";
import { UnlinkedBouncieDevices } from "@/components/admin/UnlinkedBouncieDevices";

// --- Custom marker icon ---
function createVehicleIcon(status: LiveVehicle["status"], isSelected: boolean) {
  const color = status === "moving" ? "#22c55e" : status === "idle" ? "#f59e0b" : "#6b7280";
  const size = isSelected ? 18 : 12;
  const pulse = status === "moving"
    ? `<circle cx="12" cy="12" r="10" fill="${color}" opacity="0.25"><animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.25" to="0" dur="1.5s" repeatCount="indefinite"/></circle>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [size * 2.5, size * 2.5],
    iconAnchor: [size * 1.25, size * 1.25],
    html: `<svg width="${size * 2.5}" height="${size * 2.5}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      ${pulse}
      <circle cx="12" cy="12" r="${isSelected ? 8 : 6}" fill="${color}" stroke="${isSelected ? "#F5A800" : "rgba(0,0,0,0.3)"}" stroke-width="${isSelected ? 2.5 : 1.5}"/>
      <circle cx="12" cy="12" r="2.5" fill="white" opacity="0.9"/>
    </svg>`,
  });
}

function MapBounds({ vehicles }: { vehicles: LiveVehicle[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && vehicles.length > 0) {
      const pts = vehicles
        .filter((v) => v.lat !== null && v.lng !== null)
        .map((v) => [v.lat as number, v.lng as number] as [number, number]);
      if (pts.length === 0) return;
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });
      fitted.current = true;
    }
  }, [vehicles, map]);
  return null;
}

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

export default function AdminLive() {
  const { vehicles, loading } = useFleetLive();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "moving" | "idle" | "parked">("all");
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const focusVehicle = (id: string) => {
    setSelected(id);
    const v = vehicles.find((veh) => veh.vehicle_id === id);
    if (v && v.lat !== null && v.lng !== null && mapRef.current) {
      mapRef.current.flyTo([v.lat, v.lng], 14, { duration: 0.8 });
    }
  };

  const noTelemetry = !loading && onMap.length === 0;

  return (
    <div className="space-y-4 lg:h-[calc(100vh-7rem)] flex flex-col">
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
            <p className="text-xs text-muted-foreground">Telemetria Bouncie em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  onClick={() => focusVehicle(v.vehicle_id)}
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
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/30">
            <span className="text-sm font-bold text-primary">ZEUS</span>
            <span className="text-[10px] text-muted-foreground font-light uppercase tracking-widest">Fleet Tracker</span>
          </div>

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

          {!mounted && (
            <div style={{ width: "100%", height: "100%" }} className="bg-card/30" />
          )}

          {mounted && (
          <MapContainer
            key="zeus-fleet-map"
            center={[27.5, -81.0]}
            zoom={7}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            ref={(instance) => { mapRef.current = instance; }}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapBounds vehicles={onMap} />

            {filtered.map((v) => (
              <Marker
                key={v.vehicle_id}
                position={[v.lat as number, v.lng as number]}
                icon={createVehicleIcon(v.status, selected === v.vehicle_id)}
                eventHandlers={{ click: () => focusVehicle(v.vehicle_id) }}
              >
                <Popup className="zeus-popup">
                  <div className="text-xs space-y-2 min-w-[180px]">
                    <img
                      src={getCoverImage(v.name)}
                      alt={v.name}
                      className="w-full h-24 object-cover rounded-md -mt-1"
                      loading="lazy"
                      width={180}
                      height={96}
                    />
                    <p className="font-bold text-sm">{v.name}</p>
                    <p className="font-mono text-muted-foreground">{v.plate ?? "—"}</p>
                    <div className="flex justify-between pt-1 border-t border-border/30">
                      <span>Velocidade</span>
                      <span className="font-semibold tabular-nums">{Math.round(v.speed ?? 0)} mph</span>
                    </div>
                    {v.fuel_level !== null && (
                      <div className="flex justify-between">
                        <span>Combustível</span>
                        <span className="font-semibold tabular-nums">{Math.round(v.fuel_level)}%</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/fleet/${v.vehicle_id}`);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors py-1.5 text-[11px] font-semibold"
                    >
                      <ExternalLink size={11} /> Abrir Veículo
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          )}

          {/* Selected vehicle detail overlay */}
          {selectedVehicle && (
            <div className="absolute bottom-3 right-3 z-[1000] bg-background/90 backdrop-blur-md rounded-xl border border-border/40 w-72 shadow-xl overflow-hidden">
              <img
                src={getCoverImage(selectedVehicle.name)}
                alt={selectedVehicle.name}
                className="w-full h-32 object-cover"
                loading="lazy"
                width={288}
                height={128}
              />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-foreground">{selectedVehicle.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{selectedVehicle.plate ?? "—"}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      selectedVehicle.status === "moving"
                        ? "bg-green-500/10 text-green-500"
                        : selectedVehicle.status === "idle"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {selectedVehicle.status === "moving"
                      ? "Em movimento"
                      : selectedVehicle.status === "idle"
                      ? "Parado"
                      : "Estacionado"}
                  </span>
                </div>

                {selectedVehicle.mil_on && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 mb-3">
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <span className="text-[11px] font-medium text-red-500">Luz de injeção (MIL) acesa</span>
                  </div>
                )}

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Gauge size={12} />Velocidade</span>
                    <span className="font-semibold text-foreground tabular-nums">{Math.round(selectedVehicle.speed ?? 0)} mph</span>
                  </div>
                  {selectedVehicle.fuel_level !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Fuel size={12} />Combustível</span>
                      <span className="font-semibold text-foreground tabular-nums">{Math.round(selectedVehicle.fuel_level)}%</span>
                    </div>
                  )}
                  {selectedVehicle.odometer !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Activity size={12} />Odômetro</span>
                      <span className="font-semibold text-foreground tabular-nums">{Math.round(selectedVehicle.odometer).toLocaleString("pt-BR")} mi</span>
                    </div>
                  )}
                  {selectedVehicle.battery_status && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Battery size={12} />Bateria</span>
                      <span className="font-semibold text-foreground capitalize">{selectedVehicle.battery_status}</span>
                    </div>
                  )}
                  {selectedVehicle.address && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><MapPin size={12} />Local</span>
                      <span className="font-medium text-foreground text-right text-[11px] leading-snug">{selectedVehicle.address}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock size={12} />Atualizado</span>
                    <span className="font-medium text-foreground">{formatRelative(selectedVehicle.reported_at)}</span>
                  </div>
                </div>
                {selectedVehicle.lat !== null && selectedVehicle.lng !== null && (
                  <div className="mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground/60 tabular-nums">
                    Lat: {selectedVehicle.lat.toFixed(5)} / Lng: {selectedVehicle.lng.toFixed(5)}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/admin/fleet/${selectedVehicle.vehicle_id}`)}
                  className="w-full mt-3 flex items-center justify-center gap-2 rounded-lg gold-gradient text-primary-foreground hover:opacity-90 transition-opacity py-2 text-xs font-bold"
                >
                  <ExternalLink size={13} /> Abrir Veículo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
