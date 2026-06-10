import { Users, Briefcase, Settings, Fuel, Eye, EyeOff } from "lucide-react";

type Props = {
  name: string;
  category: string;
  passengers: number;
  bags: number;
  transmission: string;
  fuel: string;
  daily_price_usd: number;
  coverUrl?: string | null;
  published: boolean;
};

export default function PublicCardPreview({
  name,
  category,
  passengers,
  bags,
  transmission,
  fuel,
  daily_price_usd,
  coverUrl,
  published,
}: Props) {
  const fuelLabel =
    fuel === "Gasoline" ? "Gasolina" : fuel === "Electric" ? "Elétrico" : fuel === "Hybrid" ? "Híbrido" : "Diesel";
  const tLabel = transmission === "Automatic" ? "Automático" : "Manual";

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Preview do anúncio
        </span>
        <span
          className={`text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
            published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {published ? <><Eye size={10} /> Vai aparecer no site</> : <><EyeOff size={10} /> Oculto do site</>}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden border border-border/40 bg-background">
        <div className="aspect-[16/10] bg-muted/40 flex items-center justify-center overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt={name || "Veículo"} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Sem foto de capa</span>
          )}
        </div>
        <div className="p-4 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{category || "Categoria"}</p>
            <h3 className="text-base font-bold text-foreground truncate">{name || "Nome do veículo"}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users size={12} />{passengers} passageiros</span>
            <span className="inline-flex items-center gap-1"><Briefcase size={12} />{bags} malas</span>
            <span className="inline-flex items-center gap-1"><Settings size={12} />{tLabel}</span>
            <span className="inline-flex items-center gap-1"><Fuel size={12} />{fuelLabel}</span>
          </div>
          <div className="flex items-end justify-between pt-2 border-t border-border/30">
            <span className="text-[11px] text-muted-foreground">A partir de</span>
            <span className="text-xl font-bold text-primary tabular-nums">${daily_price_usd || 0}/dia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
