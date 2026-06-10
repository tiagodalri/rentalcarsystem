import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Signal, Gauge, MapPin, Search, X, Car } from "lucide-react";
import { useFleetLive } from "@/hooks/useFleetLive";
import { GoogleFleetMap } from "@/components/admin/GoogleFleetMap";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { formatPersonName } from "@/lib/formatName";

/* ============================================================
   LIVE — Mobile-first
   Mapa fullscreen + bottom sheet com lista compacta.
   ============================================================ */

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

export default function MobileLive() {
  const { vehicles, loading } = useFleetLive();
  const navigate = useNavigate();
  const [listOpen, setListOpen] = useState(true);
  const [search, setSearch] = useState("");

  const onMap = useMemo(() => vehicles.filter((v) => v.lat != null && v.lng != null), [vehicles]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return !q ? onMap : onMap.filter((v) =>
      `${v.name || ""} ${v.plate || ""}`.toLowerCase().includes(q),
    );
  }, [onMap, search]);

  return (
    <div className="fixed inset-0 top-14 bottom-16 z-10">
      {/* Map fills entire mobile viewport (under header & nav) */}
      <div className="absolute inset-0">
        <GoogleFleetMap vehicles={onMap} selectedId={null} onSelect={() => {}} onOpen={(id) => navigate(`/admin/fleet/${id}`)} />
      </div>

      {/* Floating KPI strip */}
      <div className="absolute top-3 left-3 right-3 flex gap-2 pointer-events-none">
        <div className="pointer-events-auto flex-1 bg-card/90 backdrop-blur rounded-xl px-3 py-2 border border-border/50 shadow-lg">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">No mapa</div>
          <div className="text-lg font-semibold tabular-nums leading-none mt-0.5">{onMap.length}</div>
        </div>
        <div className="pointer-events-auto flex-1 bg-card/90 backdrop-blur rounded-xl px-3 py-2 border border-border/50 shadow-lg">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
          <div className="text-lg font-semibold tabular-nums leading-none mt-0.5">{vehicles.length}</div>
        </div>
      </div>

      {/* Bottom button to open list */}
      <button
        onClick={() => setListOpen(true)}
        className="absolute bottom-4 left-4 right-4 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-2xl inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Car size={16} /> Ver {onMap.length} {onMap.length === 1 ? "veículo" : "veículos"}
      </button>

      {/* Vehicles sheet */}
      <MobileSheet open={listOpen} onOpenChange={setListOpen} title={`Frota ao vivo (${onMap.length})`}>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-muted/50 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pb-6">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum veículo.</div>
          ) : filtered.map((v) => (
            <button
              key={v.vehicle_id}
              onClick={() => navigate(`/admin/fleet/${v.vehicle_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 active:bg-muted/40 text-left"
            >
              <Signal size={14} className={v.lat ? "text-emerald-500" : "text-muted-foreground"} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.name || "—"}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                  {v.plate && <span>{v.plate}</span>}
                  {v.speed != null && (
                    <span className="inline-flex items-center gap-1"><Gauge size={10} /> {Math.round(v.speed)} mph</span>
                  )}
                  <span className="inline-flex items-center gap-1"><MapPin size={10} /> {formatRelative(v.reported_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </MobileSheet>
    </div>
  );
}
