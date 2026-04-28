import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Car, Signal, Battery, Gauge, Clock, MapPin, ExternalLink } from "lucide-react";
import { getCoverImage } from "@/data/vehicleImages";

// --- Simulated fleet data ---
interface TrackedVehicle {
  id: string;
  name: string;
  plate: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  battery: number;
  status: "moving" | "idle" | "parked";
  lastUpdate: Date;
  region: string;
}

const REGIONS = {
  orlando: { center: [28.5383, -81.3792] as [number, number], radius: 0.15 },
  kissimmee: { center: [28.2919, -81.4076] as [number, number], radius: 0.08 },
  miami: { center: [25.7617, -80.1918] as [number, number], radius: 0.12 },
  miamiBeach: { center: [25.7907, -80.13] as [number, number], radius: 0.04 },
  tampa: { center: [27.9506, -82.4572] as [number, number], radius: 0.1 },
  fortLauderdale: { center: [26.1224, -80.1373] as [number, number], radius: 0.06 },
  internationalDrive: { center: [28.4289, -81.4695] as [number, number], radius: 0.03 },
  lakeBuenaVista: { center: [28.3772, -81.5217] as [number, number], radius: 0.04 },
};

const FLEET_SEED: Omit<TrackedVehicle, "lat" | "lng" | "speed" | "heading" | "battery" | "lastUpdate" | "status">[] = [
  { id: "v1", name: "Corvette Stingray C8", plate: "ZEU-0017", region: "orlando" },
  { id: "v2", name: "Mustang Conversível", plate: "ZEU-0023", region: "miami" },
  { id: "v3", name: "Cadillac Escalade", plate: "ZEU-0042", region: "miamiBeach" },
  { id: "v4", name: "BMW X5 M Sport", plate: "ZEU-0008", region: "orlando" },
  { id: "v5", name: "Chevrolet Suburban", plate: "ZEU-0055", region: "tampa" },
  { id: "v6", name: "Dodge Durango", plate: "ZEU-0031", region: "kissimmee" },
  { id: "v7", name: "Kia Sorento", plate: "ZEU-0019", region: "fortLauderdale" },
  { id: "v8", name: "Kia Sportage", plate: "ZEU-0044", region: "internationalDrive" },
  { id: "v9", name: "Mitsubishi Outlander", plate: "ZEU-0061", region: "miami" },
  { id: "v10", name: "Volkswagen Tiguan", plate: "ZEU-0037", region: "lakeBuenaVista" },
  { id: "v11", name: "Chrysler Pacifica", plate: "ZEU-0072", region: "orlando" },
  { id: "v12", name: "Lexus NX", plate: "ZEU-0015", region: "miami" },
  { id: "v13", name: "Audi Q7", plate: "ZEU-0028", region: "tampa" },
  { id: "v14", name: "Volvo XC60", plate: "ZEU-0099", region: "miamiBeach" },
  { id: "v15", name: "Nissan Kicks", plate: "ZEU-0053", region: "fortLauderdale" },
  { id: "v16", name: "Volkswagen Atlas", plate: "ZEU-0066", region: "kissimmee" },
  { id: "v17", name: "Mercedes-Benz GLA", plate: "ZEU-0078", region: "internationalDrive" },
];

function initVehicle(seed: typeof FLEET_SEED[0]): TrackedVehicle {
  const region = REGIONS[seed.region as keyof typeof REGIONS];
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * region.radius;
  const statuses: TrackedVehicle["status"][] = ["moving", "moving", "moving", "idle", "parked"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return {
    ...seed,
    lat: region.center[0] + Math.sin(angle) * dist,
    lng: region.center[1] + Math.cos(angle) * dist,
    speed: status === "moving" ? 20 + Math.random() * 60 : status === "idle" ? Math.random() * 5 : 0,
    heading: Math.random() * 360,
    battery: 40 + Math.random() * 60,
    status,
    lastUpdate: new Date(),
  };
}

function moveVehicle(v: TrackedVehicle): TrackedVehicle {
  if (v.status === "parked") {
    // Occasionally start moving
    if (Math.random() < 0.02) return { ...v, status: "idle", lastUpdate: new Date() };
    return { ...v, lastUpdate: new Date() };
  }

  const region = REGIONS[v.region as keyof typeof REGIONS];

  // Change status occasionally
  let status = v.status;
  if (Math.random() < 0.03) {
    status = status === "moving" ? "idle" : "moving";
  }

  const speed = status === "moving" ? 20 + Math.random() * 60 : Math.random() * 3;
  let heading = v.heading + (Math.random() - 0.5) * 40;

  // Steer back toward region center if too far
  const dx = region.center[1] - v.lng;
  const dy = region.center[0] - v.lat;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  if (distFromCenter > region.radius * 0.8) {
    const toCenter = (Math.atan2(dy, dx) * 180) / Math.PI;
    heading = heading * 0.6 + toCenter * 0.4;
  }

  const rad = (heading * Math.PI) / 180;
  const step = (speed / 3600) * 0.002; // Scaled movement
  const lat = v.lat + Math.sin(rad) * step;
  const lng = v.lng + Math.cos(rad) * step;

  return {
    ...v, lat, lng, speed: Math.round(speed), heading, status,
    battery: Math.max(5, v.battery - Math.random() * 0.1),
    lastUpdate: new Date(),
  };
}

// --- Custom marker icon ---
function createVehicleIcon(status: TrackedVehicle["status"], isSelected: boolean) {
  const color = status === "moving" ? "#22c55e" : status === "idle" ? "#f59e0b" : "#6b7280";
  const size = isSelected ? 18 : 12;
  const pulse = status === "moving" ? `<circle cx="12" cy="12" r="10" fill="${color}" opacity="0.25"><animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.25" to="0" dur="1.5s" repeatCount="indefinite"/></circle>` : "";

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

// --- Map auto-fit component ---
function MapBounds({ vehicles }: { vehicles: TrackedVehicle[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map((v) => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
      fitted.current = true;
    }
  }, [vehicles, map]);
  return null;
}

// --- Main component ---
export default function AdminLive() {
  const [vehicles, setVehicles] = useState<TrackedVehicle[]>(() =>
    FLEET_SEED.map(initVehicle)
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "moving" | "idle" | "parked">("all");
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);

  // Simulate real-time movement
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) => prev.map(moveVehicle));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const filtered = vehicles.filter((v) => filter === "all" || v.status === filter);
  const selectedVehicle = vehicles.find((v) => v.id === selected);

  const stats = useMemo(() => ({
    total: vehicles.length,
    moving: vehicles.filter((v) => v.status === "moving").length,
    idle: vehicles.filter((v) => v.status === "idle").length,
    parked: vehicles.filter((v) => v.status === "parked").length,
    avgSpeed: Math.round(vehicles.filter((v) => v.status === "moving").reduce((s, v) => s + v.speed, 0) / Math.max(1, vehicles.filter((v) => v.status === "moving").length)),
  }), [vehicles]);

  const focusVehicle = (id: string) => {
    setSelected(id);
    const v = vehicles.find((veh) => veh.id === id);
    if (v && mapRef.current) {
      mapRef.current.flyTo([v.lat, v.lng], 14, { duration: 0.8 });
    }
  };

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
            <p className="text-xs text-muted-foreground">Monitoramento em tempo real da frota</p>
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
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 lg:h-[calc(100%-8rem)]">
        {/* Vehicle list sidebar */}
        <div className="w-full lg:w-72 lg:shrink-0 flex flex-col gap-2 lg:overflow-hidden">
          {/* Filter tabs */}
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

          {/* Vehicle cards */}
          <div className="lg:flex-1 lg:overflow-y-auto space-y-1.5 lg:pr-1 scrollbar-thin">
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => focusVehicle(v.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                  selected === v.id
                    ? "bg-primary/5 border-primary/40 shadow-sm shadow-primary/10"
                    : "bg-card/50 border-border/30 hover:border-border/60 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={getCoverImage(v.name)}
                    alt={v.name}
                    className="w-12 h-9 rounded object-cover flex-shrink-0 border border-border/20"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{v.name}</span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        v.status === "moving" ? "bg-green-500" : v.status === "idle" ? "bg-yellow-500" : "bg-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-mono">{v.plate}</span>
                      <span className="flex items-center gap-1">
                        <Gauge size={10} />
                        {v.speed} mph
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border/40 relative h-[60vh] lg:h-auto min-h-[400px]">
          {/* Zeus watermark */}
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/30">
            <span className="text-sm font-bold text-primary">ZEUS</span>
            <span className="text-[10px] text-muted-foreground font-light uppercase tracking-widest">Fleet Tracker</span>
          </div>

          <MapContainer
            center={[27.5, -81.0]}
            zoom={7}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
            ref={mapRef}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapBounds vehicles={vehicles} />

            {filtered.map((v) => (
              <Marker
                key={v.id}
                position={[v.lat, v.lng]}
                icon={createVehicleIcon(v.status, selected === v.id)}
                eventHandlers={{ click: () => focusVehicle(v.id) }}
              >
                <Popup className="zeus-popup">
                  <div className="text-xs space-y-2 min-w-[180px]">
                    <img
                      src={getCoverImage(v.name)}
                      alt={v.name}
                      className="w-full h-24 object-cover rounded-md -mt-1"
                    />
                    <p className="font-bold text-sm">{v.name}</p>
                    <p className="font-mono text-muted-foreground">{v.plate}</p>
                    <div className="flex justify-between pt-1 border-t border-border/30">
                      <span>Velocidade</span>
                      <span className="font-semibold">{v.speed} mph</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bateria</span>
                      <span className="font-semibold">{Math.round(v.battery)}%</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/reserva/${encodeURIComponent(v.name)}`, { state: { fromLive: true } }); }}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors py-1.5 text-[11px] font-semibold"
                    >
                      <ExternalLink size={11} /> Abrir Reserva
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Selected vehicle detail overlay */}
          {selectedVehicle && (
            <div className="absolute bottom-3 right-3 z-[1000] bg-background/90 backdrop-blur-md rounded-xl border border-border/40 w-72 shadow-xl overflow-hidden">
              <img
                src={getCoverImage(selectedVehicle.name)}
                alt={selectedVehicle.name}
                className="w-full h-32 object-cover"
              />
              <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground">{selectedVehicle.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{selectedVehicle.plate}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  selectedVehicle.status === "moving" ? "bg-green-500/10 text-green-500" :
                  selectedVehicle.status === "idle" ? "bg-yellow-500/10 text-yellow-500" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {selectedVehicle.status === "moving" ? "Em movimento" : selectedVehicle.status === "idle" ? "Parado" : "Estacionado"}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Gauge size={12} />Velocidade</span>
                  <span className="font-semibold text-foreground">{selectedVehicle.speed} mph</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Battery size={12} />Rastreador</span>
                  <span className="font-semibold text-foreground">{Math.round(selectedVehicle.battery)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><MapPin size={12} />Região</span>
                  <span className="font-semibold text-foreground capitalize">{selectedVehicle.region.replace(/([A-Z])/g, " $1").trim()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Signal size={12} />Sinal</span>
                  <span className="font-semibold text-green-500">Ativo</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground/60">
                Lat: {selectedVehicle.lat.toFixed(5)} / Lng: {selectedVehicle.lng.toFixed(5)}
              </div>
              <button
                onClick={() => navigate(`/reserva/${encodeURIComponent(selectedVehicle.name)}`, { state: { fromLive: true } })}
                className="w-full mt-3 flex items-center justify-center gap-2 rounded-lg gold-gradient text-primary-foreground hover:opacity-90 transition-opacity py-2 text-xs font-bold"
              >
                <ExternalLink size={13} /> Abrir Página de Reserva
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
