import { MapPin, Plane, Building2, Copy, ExternalLink, Check, CalendarDays } from "lucide-react";
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

/**
 * Splits a long address (Nominatim-style, comma separated) into readable lines:
 *  1. Place name / first segment
 *  2. Street (number + street name)
 *  3. City / county
 *  4. State / zip / country
 */
function structureAddress(address: string) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { primary: address, lines: [] as string[] };

  const primary = parts[0];
  const rest = parts.slice(1);

  if (rest.length <= 2) {
    return { primary, lines: [rest.join(", ")] };
  }

  // Try to group: street (first 1-2), middle (city/county), tail (state/zip/country)
  const tailCount = Math.min(3, rest.length); // last up to 3 = state, zip, country
  const tail = rest.slice(-tailCount);
  const middle = rest.slice(0, rest.length - tailCount);

  const lines: string[] = [];
  if (middle.length > 0) {
    // split middle roughly in half: street vs city
    if (middle.length >= 3) {
      const half = Math.ceil(middle.length / 2);
      lines.push(middle.slice(0, half).join(", "));
      lines.push(middle.slice(half).join(", "));
    } else {
      lines.push(middle.join(", "));
    }
  }
  lines.push(tail.join(" · "));

  return { primary, lines };
}

export function LocationDisplay({ label, date, address }: Props) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/60 text-muted-foreground/70">
            <MapPin size={13} />
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
        </div>
        <p className="text-xs text-muted-foreground italic pl-9">Endereço não informado</p>
      </div>
    );
  }

  const { primary, lines } = structureAddress(address);
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
    <div className="relative rounded-2xl border border-border/50 bg-card/70 overflow-hidden transition-colors hover:border-border">
      {/* Accent strip */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/60" />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary shrink-0">
              <Icon size={14} />
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
              {label}
            </span>
          </div>
          {date && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground tabular-nums bg-muted/60 border border-border/40 px-2.5 py-1 rounded-full shrink-0">
              <CalendarDays size={11} className="text-muted-foreground" />
              {date}
            </span>
          )}
        </div>

        {/* Address body */}
        <div className="space-y-1">
          <p className="text-[15px] sm:text-base font-semibold text-foreground leading-snug break-words">
            {primary}
          </p>
          {lines.map((line, i) => (
            <p
              key={i}
              className={`text-xs sm:text-[13px] leading-relaxed break-words ${
                i === lines.length - 1 ? "text-muted-foreground/80" : "text-muted-foreground"
              }`}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/30">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground bg-muted/40 hover:bg-muted/70 active:bg-muted px-3 min-h-9 rounded-lg transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? "Copiado" : "Copiar endereço"}
          </button>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20 px-3 min-h-9 rounded-lg transition-colors"
          >
            <ExternalLink size={13} />
            Abrir no Maps
          </a>
        </div>
      </div>
    </div>
  );
}
