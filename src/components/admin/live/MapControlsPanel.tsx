import { useEffect, useRef, useState } from "react";
import { Settings2, X, Check, Database, Loader2 } from "lucide-react";

export type MapLayers = {
  mapType: "roadmap" | "satellite" | "satellite3d";
  traffic: boolean;
  carvatars: boolean; // deprecated, kept for type compat. always false
  nwsAlerts: boolean;
  speedLegend: boolean;
  tripEvents: boolean;
};

export const DEFAULT_LAYERS: MapLayers = {
  mapType: "roadmap",
  traffic: false,
  carvatars: false,
  nwsAlerts: false,
  speedLegend: true,
  tripEvents: true,
};

const STORAGE_KEY = "zeus.liveMap.layers.v3";

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayers>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LAYERS, ...JSON.parse(raw), carvatars: false };
    } catch {}
    return DEFAULT_LAYERS;
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...layers, carvatars: false }));
    } catch {}
  }, [layers]);
  return [layers, setLayers] as const;
}

type ToggleCardProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  preview: React.ReactNode;
  liveBadge?: boolean;
};

function ToggleCard({ label, active, onClick, preview, liveBadge }: ToggleCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
      aria-pressed={active}
    >
      <div
        className={`relative w-[72px] h-[72px] rounded-2xl overflow-hidden border-2 transition-all ${
          active
            ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
            : "border-border/40 group-hover:border-border"
        }`}
      >
        {preview}
        {liveBadge && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-medium tracking-wider text-white bg-primary px-1.5 py-0.5 rounded">
            LIVE
          </span>
        )}
        {active && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <Check size={10} className="text-primary-foreground" strokeWidth={3} />
          </span>
        )}
      </div>
      <span
        className={`text-[11px] font-semibold text-center leading-tight ${
          active ? "text-primary" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

const previews = {
  road: (
    <div className="w-full h-full bg-[#e8e4d8] relative">
      <div className="absolute inset-x-0 top-1/3 h-1 bg-white" />
      <div className="absolute inset-y-0 left-1/3 w-1 bg-white" />
      <div className="absolute top-1 left-1 w-4 h-3 bg-[#d4cfc0]" />
    </div>
  ),
  satellite: (
    <div className="w-full h-full bg-gradient-to-br from-[#2d4a2b] via-[#5a7a3e] to-[#8b6f47] relative">
      <div className="absolute top-2 left-2 w-3 h-3 bg-[#6b5b3f] rounded-sm" />
      <div className="absolute bottom-2 right-2 w-4 h-4 bg-[#4a6b3a] rounded-sm" />
      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#a89968]" />
    </div>
  ),
  satellite3d: (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-b from-[#3d5a8a] via-[#5a7a3e] to-[#2d3a1f]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(135,170,210,0.55) 0%, rgba(135,170,210,0) 38%), repeating-linear-gradient(72deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 9px)",
          transform: "perspective(80px) rotateX(38deg) scale(1.25) translateY(6px)",
          transformOrigin: "center bottom",
        }}
      />
      <div
        className="absolute left-2 bottom-3 w-3 h-5 bg-[#1f2a3a]"
        style={{ transform: "perspective(60px) rotateX(35deg)" }}
      />
      <div
        className="absolute right-3 bottom-2 w-2.5 h-7 bg-[#0f1622]"
        style={{ transform: "perspective(60px) rotateX(35deg)" }}
      />
    </div>
  ),
  nws: (
    <div className="w-full h-full bg-[#e8e4d8] relative">
      <svg viewBox="0 0 72 72" className="absolute inset-0">
        <polygon
          points="15,15 55,12 60,40 50,58 18,55 10,30"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  ),
  traffic: (
    <div className="w-full h-full bg-[#e8e4d8] relative">
      <div className="absolute inset-x-0 top-3 h-1.5 bg-[#22c55e]" />
      <div className="absolute inset-x-0 top-7 h-1.5 bg-[#f59e0b]" />
      <div className="absolute inset-x-0 top-11 h-1.5 bg-[#ef4444]" />
      <div className="absolute inset-x-0 bottom-3 h-1.5 bg-[#22c55e]" />
    </div>
  ),
  carvatars: (
    <div className="w-full h-full bg-[#dde8f2] relative flex items-center justify-center">
      <div className="w-9 h-9 rounded-full bg-white border-2 border-foreground/30 flex items-center justify-center text-[18px]">
        <svg width="20" height="14" viewBox="0 0 24 16" fill="none">
          <path
            d="M2 11h20l-2-6H4l-2 6zm2 1v2h3v-2m10 0v2h3v-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  ),
  speedLegend: (
    <div className="w-full h-full bg-white relative flex items-center justify-center">
      <div className="w-3 h-12 rounded-full bg-gradient-to-b from-[#ef4444] via-[#22c55e] to-[#f59e0b]" />
    </div>
  ),
  tripEvents: (
    <div className="w-full h-full bg-[#dde8f2] relative flex items-center justify-center">
      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="#fbbf24" />
          <circle cx="12" cy="5" r="2" fill="#22c55e" />
          <circle cx="12" cy="19" r="2" fill="#ef4444" />
        </svg>
      </div>
    </div>
  ),
};

type Props = {
  layers: MapLayers;
  onChange: (l: MapLayers) => void;
  onRunBackfill?: () => void;
  backfillRunning?: boolean;
};

export function MapControlsPanel({ layers, onChange, onRunBackfill, backfillRunning }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const set = <K extends keyof MapLayers>(key: K, value: MapLayers[K]) =>
    onChange({ ...layers, [key]: value });

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Configurar mapa"
        className="w-10 h-10 rounded-lg bg-background/95 backdrop-blur-sm border border-border/40 shadow-md flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Settings2 size={18} className="text-foreground" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-14 right-0 z-[1001] w-[360px] bg-background/98 backdrop-blur-xl rounded-2xl border border-border/40 shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>

          <div className="mb-4">
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Aparência do mapa
            </h3>
            <div className="flex gap-4">
              <ToggleCard
                label="Estrada"
                active={layers.mapType === "roadmap"}
                onClick={() => set("mapType", "roadmap")}
                preview={previews.road}
              />
              <ToggleCard
                label="Satélite"
                active={layers.mapType === "satellite"}
                onClick={() => set("mapType", "satellite")}
                preview={previews.satellite}
              />
              <ToggleCard
                label="Satélite 3D"
                active={layers.mapType === "satellite3d"}
                onClick={() => set("mapType", "satellite3d")}
                preview={previews.satellite3d}
              />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Camadas do mapa
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <ToggleCard
                label="Alertas NWS"
                active={layers.nwsAlerts}
                onClick={() => set("nwsAlerts", !layers.nwsAlerts)}
                preview={previews.nws}
                liveBadge
              />
              <ToggleCard
                label="Trânsito ao vivo"
                active={layers.traffic}
                onClick={() => set("traffic", !layers.traffic)}
                preview={previews.traffic}
                liveBadge
              />
              <ToggleCard
                label="Legenda de velocidade"
                active={layers.speedLegend}
                onClick={() => set("speedLegend", !layers.speedLegend)}
                preview={previews.speedLegend}
              />
              <ToggleCard
                label="Eventos de viagem"
                active={layers.tripEvents}
                onClick={() => set("tripEvents", !layers.tripEvents)}
                preview={previews.tripEvents}
              />
            </div>
          </div>

          {onRunBackfill && (
            <div className="mt-5 pt-4 border-t border-border/40">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Manutenção
              </h3>
              <button
                onClick={() => {
                  onRunBackfill();
                }}
                disabled={backfillRunning}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {backfillRunning ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Database size={13} />
                )}
                Backfill histórico
              </button>
              <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                Reimporta o histórico recente do Bouncie para os veículos vinculados.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
