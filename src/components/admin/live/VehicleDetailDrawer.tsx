import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { getCoverImage } from "@/data/vehicleImages";
import { X, ExternalLink, MapPin, Share2 } from "lucide-react";
import { TripsTab } from "./tabs/TripsTab";
import { StatsTab } from "./tabs/StatsTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { DetailsTab } from "./tabs/DetailsTab";
import { VehicleHealthFooter } from "./VehicleHealthFooter";
import { ShareTrackingDialog } from "./ShareTrackingDialog";


type Tab = "trips" | "stats" | "notifications" | "details";

const TABS: { id: Tab; label: string }[] = [
  { id: "trips", label: "Viagens" },
  { id: "stats", label: "Estatísticas" },
  { id: "notifications", label: "Notificações" },
  { id: "details", label: "Detalhes" },
];

export function VehicleDetailDrawer({
  vehicle,
  onClose,
}: {
  vehicle: LiveVehicle;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("trips");
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();


  const statusLabel =
    vehicle.status === "moving" ? "Em movimento" : vehicle.status === "idle" ? "Parado" : "Estacionado";
  const statusColor =
    vehicle.status === "moving"
      ? "bg-green-500/15 text-green-500"
      : vehicle.status === "idle"
      ? "bg-yellow-500/15 text-yellow-500"
      : "bg-muted text-muted-foreground";

  return (
    <div className="absolute top-0 right-0 bottom-0 z-[1100] w-full sm:w-[420px] bg-background border-l border-border/40 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 border-b border-border/30">
        <div className="relative">
          <img
            src={vehicle.image_url || getCoverImage(vehicle.name)}
            alt={vehicle.name}
            className="w-full h-32 object-cover bg-muted"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 flex items-center justify-center hover:bg-background transition-colors"
          >
            <X size={15} />
          </button>
          <button
            onClick={() => navigate(`/admin/fleet/${vehicle.vehicle_id}`)}
            aria-label="Abrir ficha"
            className="absolute top-2 left-2 px-2.5 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider hover:bg-background transition-colors"
          >
            <ExternalLink size={11} /> Ficha
          </button>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Compartilhar rastreamento"
            title="Compartilhar rastreamento (link público)"
            className="absolute top-2 right-12 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 flex items-center justify-center hover:bg-background transition-colors text-primary"
          >
            <Share2 size={13} />
          </button>
        </div>


        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="min-w-0">
              <h2 className="text-base font-medium text-foreground leading-tight truncate">{vehicle.name}</h2>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{vehicle.plate ?? ""}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider shrink-0 ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {vehicle.address && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-snug">
              <MapPin size={11} className="text-primary mt-0.5 shrink-0" />
              <span className="block truncate min-w-0">{vehicle.address}</span>
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border/20">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 text-[10px] uppercase tracking-wider font-medium py-2.5 transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {active && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === "trips" && <TripsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "stats" && <StatsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "notifications" && <NotificationsTab vehicleId={vehicle.vehicle_id} />}
        {tab === "details" && <DetailsTab vehicle={vehicle} vehicleId={vehicle.vehicle_id} />}
      </div>

      {/* Footer */}
      <div className="shrink-0">
        <VehicleHealthFooter vehicle={vehicle} />
      </div>

      <ShareTrackingDialog
        vehicleId={vehicle.vehicle_id}
        vehicleName={vehicle.name}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

