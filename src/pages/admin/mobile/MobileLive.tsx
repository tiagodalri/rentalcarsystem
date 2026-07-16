import { useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Signal,
  Gauge,
  MapPin,
  Search,
  X,
  Car,
  Share2,
  ExternalLink,
  Crosshair,
  Clock,
} from "lucide-react";
import { useFleetLive, type LiveVehicle } from "@/hooks/useFleetLive";
import { LoadingRows } from "@/components/skeletons/LoadingRows";
import { GoogleFleetMap } from "@/components/admin/GoogleFleetMap";
import { FleetAlertsCenter } from "@/components/admin/live/FleetAlertsCenter";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { ShareTrackingDialog } from "@/components/admin/live/ShareTrackingDialog";
import { TripsTab } from "@/components/admin/live/tabs/TripsTab";
import { StatsTab } from "@/components/admin/live/tabs/StatsTab";
import { NotificationsTab } from "@/components/admin/live/tabs/NotificationsTab";
import { DetailsTab } from "@/components/admin/live/tabs/DetailsTab";
import { VehicleHealthFooter } from "@/components/admin/live/VehicleHealthFooter";
import { getCoverImage } from "@/data/vehicleImages";
import { haptic } from "@/lib/haptic";

type DetailTab = "trips" | "stats" | "notifications" | "details";
const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "trips", label: "Viagens" },
  { id: "stats", label: "Estatísticas" },
  { id: "notifications", label: "Notificações" },
  { id: "details", label: "Detalhes" },
];

/* ============================================================
   LIVE — Mobile-first (native app feel)
   - Mapa fullscreen respeitando safe-area (notch + bottom nav)
   - Tap em veículo abre bottom-sheet com ações (rastreador, ficha)
   - Lista compacta com busca + filtro de status
   ============================================================ */

type StatusFilter = "all" | "moving" | "idle" | "parked";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function statusMeta(s: LiveVehicle["status"]) {
  if (s === "moving") return { label: "Em movimento", dot: "bg-emerald-500", text: "text-emerald-500" };
  if (s === "idle") return { label: "Parado", dot: "bg-amber-500", text: "text-amber-500" };
  return { label: "Estacionado", dot: "bg-muted-foreground", text: "text-muted-foreground" };
}

export default function MobileLive() {
  const { vehicles, loading } = useFleetLive();
  const navigate = useNavigate();

  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const onMap = useMemo(
    () => vehicles.filter((v) => v.lat != null && v.lng != null),
    [vehicles],
  );

  const selected = useMemo(
    () => vehicles.find((v) => v.vehicle_id === selectedId) ?? null,
    [vehicles, selectedId],
  );

  const counts = useMemo(() => {
    const c = { all: onMap.length, moving: 0, idle: 0, parked: 0 };
    for (const v of onMap) c[v.status]++;
    return c;
  }, [onMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = filter === "all" ? onMap : onMap.filter((v) => v.status === filter);
    const list = !q
      ? base
      : base.filter((v) => `${v.name || ""} ${v.plate || ""}`.toLowerCase().includes(q));
    const order = { moving: 0, idle: 1, parked: 2 };
    return [...list].sort((a, b) => order[a.status] - order[b.status]);
  }, [onMap, search, filter]);

  const openVehicle = useCallback((id: string) => {
    haptic.tick();
    setSelectedId(id);
    setDetailOpen(true);
    setListOpen(false);
  }, []);

  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className="relative z-10"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      }}
    >
      {/* Map: altura confortável, permite rolar a página */}
      <div
        ref={mapWrapRef}
        className="relative h-[70vh] min-h-[420px] overflow-hidden"
      >
        <div className="absolute inset-0">
          <GoogleFleetMap
            vehicles={onMap}
            selectedId={selectedId}
            onSelect={openVehicle}
            onOpen={openVehicle}
          />
        </div>

        {/* Floating KPI strip */}
        <div className="absolute top-3 left-3 right-3 flex gap-2 pointer-events-none">
          <div className="pointer-events-auto flex-1 bg-card/90 backdrop-blur rounded-xl px-3 py-2 border border-border/50 shadow-lg">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">No mapa</div>
            <div className="text-lg font-semibold tabular-nums leading-none mt-0.5">{onMap.length}</div>
          </div>
          <div className="pointer-events-auto flex-1 bg-card/90 backdrop-blur rounded-xl px-3 py-2 border border-border/50 shadow-lg">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Em movimento</div>
            <div className="text-lg font-semibold tabular-nums leading-none mt-0.5 text-emerald-500">
              {counts.moving}
            </div>
          </div>
          <div className="pointer-events-auto flex-1 bg-card/90 backdrop-blur rounded-xl px-3 py-2 border border-border/50 shadow-lg">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
            <div className="text-lg font-semibold tabular-nums leading-none mt-0.5">{vehicles.length}</div>
          </div>
        </div>

        {/* Bottom button to open list */}
        <button
          onClick={() => {
            haptic.tick();
            setListOpen(true);
          }}
          aria-label="Abrir lista de veículos"
          className="absolute bottom-4 left-4 right-4 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-2xl inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Car size={16} /> Ver {onMap.length} {onMap.length === 1 ? "veículo" : "veículos"}
        </button>
      </div>

      {/* Central de Alertas abaixo do mapa */}
      <div className="px-3 pt-4">
        <FleetAlertsCenter
          vehicles={vehicles}
          onSelectVehicle={(id) => openVehicle(id)}
          onFocusMap={() =>
            mapWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      </div>


      {/* ===== Bottom-sheet: lista de veículos ===== */}
      <MobileSheet
        open={listOpen}
        onOpenChange={setListOpen}
        title={`Frota ao vivo (${onMap.length})`}
        contentClassName="px-0"
      >
        <div className="px-4 pb-3 space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou placa"
              inputMode="search"
              autoComplete="off"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-muted/50 border-0 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filtro segmentado por status */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/40">
            {(
              [
                { id: "all", label: "Todos", n: counts.all },
                { id: "moving", label: "Andando", n: counts.moving },
                { id: "idle", label: "Parado", n: counts.idle },
                { id: "parked", label: "Estac.", n: counts.parked },
              ] as { id: StatusFilter; label: string; n: number }[]
            ).map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    haptic.tick();
                    setFilter(f.id);
                  }}
                  className={`h-9 rounded-lg text-[11px] font-semibold transition-colors ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {f.label} <span className="tabular-nums opacity-70">({f.n})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto overscroll-contain pb-6">
          {loading ? (
            <LoadingRows count={5} rowHeight={72} />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum veículo encontrado.
            </div>
          ) : (
            filtered.map((v) => {
              const m = statusMeta(v.status);
              return (
                <button
                  key={v.vehicle_id}
                  onClick={() => openVehicle(v.vehicle_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 active:bg-muted/40 text-left"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{v.name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                      {v.plate && <span className="font-mono">{v.plate}</span>}
                      {v.speed != null && (
                        <span className="inline-flex items-center gap-1">
                          <Gauge size={10} /> {Math.round(v.speed)} mph
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> {formatRelative(v.reported_at)}
                      </span>
                    </div>
                  </div>
                  <Signal size={14} className={v.lat ? m.text : "text-muted-foreground"} />
                </button>
              );
            })
          )}
        </div>
      </MobileSheet>

      {/* ===== Bottom-sheet: detalhe completo do veículo (tabs) ===== */}
      <MobileSheet
        open={detailOpen && !!selected}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedId(null);
        }}
        showHandle
        className="h-[92dvh]"
        contentClassName="px-0"
      >
        {selected && (
          <VehicleDetailSheetContent
            vehicle={selected}
            onShare={() => setShareOpen(true)}
            onOpenFicha={() => {
              setDetailOpen(false);
              navigate(`/admin/fleet/${selected.vehicle_id}`);
            }}
            onCenter={() => {
              haptic.tick();
              setDetailOpen(false);
              setSelectedId(null);
              requestAnimationFrame(() => setSelectedId(selected.vehicle_id));
            }}
          />
        )}
      </MobileSheet>

      {/* Share/tracking dialog (link público) */}
      {selected && (
        <ShareTrackingDialog
          vehicleId={selected.vehicle_id}
          vehicleName={selected.name}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Conteúdo do bottom-sheet de detalhe — mesma riqueza do desktop:
   hero + ações + tabs (Viagens/Estatísticas/Notificações/Detalhes)
   + health footer fixo no fim.
   ============================================================ */
function VehicleDetailSheetContent({
  vehicle,
  onShare,
  onOpenFicha,
  onCenter,
}: {
  vehicle: LiveVehicle;
  onShare: () => void;
  onOpenFicha: () => void;
  onCenter: () => void;
}) {
  const m = statusMeta(vehicle.status);
  const [tab, setTab] = useState<DetailTab>("trips");

  return (
    <div className="flex flex-col h-full">
      {/* Hero com imagem do veículo */}
      <div className="relative h-32 bg-muted shrink-0">
        <img
          src={getCoverImage(vehicle.name)}
          alt={vehicle.name}
          className="w-full h-full object-cover"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-background/90 backdrop-blur ${m.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          {m.label}
        </span>
      </div>

      {/* Title + plate + endereço + ações compactas */}
      <div className="px-5 pt-3 pb-3 shrink-0 border-b border-border/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight truncate">{vehicle.name}</h2>
            <p className="text-[12px] font-mono text-muted-foreground mt-0.5">{vehicle.plate ?? "—"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { haptic.tick(); onShare(); }}
              aria-label="Compartilhar rastreador"
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center active:scale-95 transition-transform"
            >
              <Share2 size={15} />
            </button>
            <button
              onClick={onCenter}
              aria-label="Centralizar no mapa"
              className="w-9 h-9 rounded-full border border-border bg-background inline-flex items-center justify-center active:bg-muted/40"
            >
              <Crosshair size={15} />
            </button>
            <button
              onClick={() => { haptic.tick(); onOpenFicha(); }}
              aria-label="Abrir ficha"
              className="w-9 h-9 rounded-full border border-border bg-background inline-flex items-center justify-center active:bg-muted/40"
            >
              <ExternalLink size={15} />
            </button>
          </div>
        </div>

        {vehicle.address && (
          <p className="text-[12px] text-muted-foreground flex items-start gap-1.5 leading-snug mt-2">
            <MapPin size={12} className="text-primary mt-0.5 shrink-0" />
            <span className="min-w-0">{vehicle.address}</span>
          </p>
        )}

        {/* KPI rápidos */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Velocidade</div>
            <div className="text-sm font-semibold tabular-nums leading-none mt-1 inline-flex items-baseline gap-1">
              <Gauge size={11} className="text-muted-foreground" />
              {Math.round(vehicle.speed ?? 0)}
              <span className="text-[10px] text-muted-foreground font-normal">mph</span>
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Combustível</div>
            <div className="text-sm font-semibold tabular-nums leading-none mt-1">
              {vehicle.fuel_level != null ? `${Math.round(vehicle.fuel_level)}%` : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Visto</div>
            <div className="text-sm font-semibold tabular-nums leading-none mt-1 inline-flex items-baseline gap-1">
              <Clock size={11} className="text-muted-foreground" />
              {formatRelative(vehicle.reported_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border/30 overflow-x-auto scrollbar-thin">
        {DETAIL_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { haptic.tick(); setTab(t.id); }}
              className={`flex-1 min-w-[88px] text-[11px] uppercase tracking-wider font-semibold py-3 transition-colors relative ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {t.label}
              {active && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da tab — único scroller */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === "trips" && <TripsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "stats" && <StatsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "notifications" && <NotificationsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "details" && <DetailsTab vehicle={vehicle} vehicleId={vehicle.vehicle_id} />}
      </div>

      {/* Health footer fixo */}
      <div className="shrink-0 border-t border-border/30" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <VehicleHealthFooter vehicle={vehicle} />
      </div>
    </div>
  );
}
