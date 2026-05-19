import { MapPin, Plane, Building2, Copy, ExternalLink, Check } from "lucide-react";
import { useState } from "react";

type Props = {
  label: string;
  date?: string;
  address?: string | null;
};

function pickIcon(addr: string) {
  const a = addr.toLowerCase();
  if (a.includes("airport") || a.includes("aeroporto")) return Plane;
  if (a.includes("hotel") || a.includes("resort") || a.includes("inn")) return Building2;
  return MapPin;
}

export function LocationDisplay({ label, date, address }: Props) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={13} className="text-muted-foreground/60" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-xs text-muted-foreground italic">Endereço não informado</p>
      </div>
    );
  }

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const primary = parts[0] || address;
  const secondary = parts.slice(1).join(", ");
  const Icon = pickIcon(address);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="group relative rounded-xl border border-border/40 bg-card/60 hover:bg-card/80 hover:border-border/60 transition-all px-4 py-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
            <Icon size={12} />
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {date && (
          <span className="text-[10px] font-medium text-foreground/80 tabular-nums bg-muted/40 px-2 py-0.5 rounded-md">
            {date}
          </span>
        )}
      </div>

      <div className="pl-8">
        <p className="text-sm font-semibold text-foreground leading-snug">{primary}</p>
        {secondary && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{secondary}</p>
        )}

        <div className="flex items-center gap-1 mt-2.5 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted/60 transition-colors"
            title="Copiar endereço"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary px-1.5 py-1 rounded-md hover:bg-muted/60 transition-colors"
            title="Abrir no Google Maps"
          >
            <ExternalLink size={11} />
            Maps
          </a>
        </div>
      </div>
    </div>
  );
}
