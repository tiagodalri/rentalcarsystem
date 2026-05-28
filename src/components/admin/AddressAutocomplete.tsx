import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Bias search around this region (default: Orlando/FL). Use "br" for Brazil-wide. */
  countryCodes?: string;
}

/**
 * Free address autocomplete using OpenStreetMap Nominatim.
 * No API key required. Usage policy: max 1 req/sec, identifying User-Agent.
 */
export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  countryCodes = "us,br",
}: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=${countryCodes}&q=${encodeURIComponent(q)}`;
    fetch(url, { headers: { "Accept-Language": "pt-BR,en" } })
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        setResults(data || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const handleInput = (v: string) => {
    setQuery(v);
    onChange(v);
    setOpen(false);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => search(v), 400);
  };

  const handleClear = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange("");
  };

  const handleSelect = (r: NominatimResult) => {
    onChange(r.display_name);
    setQuery(r.display_name);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn("h-11 pr-20 text-[15px]", className)}
      />
      {loading && (
        <Loader2 size={14} className="absolute right-11 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {query && !loading && (
        <button
          type="button"
          aria-label="Limpar local"
          onClick={handleClear}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={14} />
        </button>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b border-border/30 last:border-b-0"
            >
              <MapPin size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="leading-tight">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
