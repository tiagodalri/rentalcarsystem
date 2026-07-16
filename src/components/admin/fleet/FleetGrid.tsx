import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Car, Users as UsersIcon, Briefcase, History, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getCoverImage, hasCoverImage } from "@/data/vehicleImages";
import { storageThumb } from "@/lib/storageThumb";

export type FleetVehicleCard = {
  id: string;
  name: string;
  category: string;
  year: number | null;
  status: string;
  published: boolean;
  daily_price_usd: number;
  passengers: number;
  bags: number;
  transmission: string;
  image_url: string | null;
  photos: string[] | null;
};

type Props = {
  vehicles: FleetVehicleCard[];
  onTogglePublished: (v: FleetVehicleCard) => void;
  onDelete: (id: string) => void;
};

const statusColors: Record<string, string> = {
  available: "bg-green-500/10 text-green-600 dark:text-green-500",
  rented: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  maintenance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
  preparing: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  unavailable: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  rented: "Alugado",
  maintenance: "Manutenção",
  preparing: "Em Preparação",
  unavailable: "Indisponível",
};
const statusLabel = (s: string) => STATUS_LABEL[s] || "Indisponível";

export default function FleetGrid({ vehicles, onTogglePublished, onDelete }: Props) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {vehicles.map((v) => (
        <Card
          key={v.id}
          className="bg-card/50 border-border/40 hover:border-primary/20 transition-colors overflow-hidden cursor-pointer"
          onClick={() => navigate(`/admin/fleet/${v.id}`)}
        >
          <div className="h-40 bg-muted/30 overflow-hidden flex items-center justify-center">
            {(() => {
              const raw = v.image_url || (v.photos && v.photos[0]) || "";
              const dbImg = raw && !raw.includes("placeholder") ? raw : "";
              const thumb = storageThumb(dbImg, 640, 360);
              const src = thumb || (hasCoverImage(v.name) ? getCoverImage(v.name) : "");
              if (!src) {
                return (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-1">
                    <Car size={40} strokeWidth={1.2} />
                    <span className="text-[10px] uppercase tracking-wider">Sem foto</span>
                  </div>
                );
              }
              return (
                <img
                  src={src}
                  alt={v.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width={640}
                  height={360}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (hasCoverImage(v.name) && !img.src.endsWith(getCoverImage(v.name))) {
                      img.src = getCoverImage(v.name);
                    } else if (!img.src.endsWith("/placeholder.svg")) {
                      img.src = "/placeholder.svg";
                    }
                  }}
                />
              );
            })()}
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{v.name}</h3>
                <p className="text-xs text-muted-foreground">{v.category} · {v.year || ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[v.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel(v.status)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><UsersIcon size={12} />{v.passengers}</span>
              <span className="flex items-center gap-1"><Briefcase size={12} />{v.bags}</span>
              <span>{v.transmission === "Automatic" ? "Automático" : "Manual"}</span>
            </div>

            {/* Publish switch. prominent per row */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between pt-2 border-t border-border/30"
            >
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {v.published ? "Ativo no site" : "Inativo no site"}
              </span>
              <Switch
                checked={v.published}
                onCheckedChange={() => onTogglePublished(v)}
                aria-label={v.published ? "Desativar do site" : "Ativar no site"}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <span className="text-lg font-medium text-primary tabular-nums">${v.daily_price_usd}/dia</span>
              <div className="flex gap-2">

                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/vehicle-history/${v.id}`); }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Histórico de Locações"
                >
                  <History size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/fleet/${v.id}?tab=details`); }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Editar ficha"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
