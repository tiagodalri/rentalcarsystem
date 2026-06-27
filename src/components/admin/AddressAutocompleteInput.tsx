import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Lightweight address autocomplete using Google Places API (New) browser surface.
 * Uses AutocompleteSuggestion.fetchAutocompleteSuggestions — não usa o widget legado.
 * Bias automático em direção à Florida (Orlando).
 */
export function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = "Endereço (rua, número, cidade)",
  className,
  disabled,
  id,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; primary: string; secondary: string }>
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        setLoading(true);
        const google = await loadGoogleMaps();
        if (!placesLibRef.current) {
          placesLibRef.current = await google.maps.importLibrary("places");
        }
        const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLibRef.current;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const { suggestions: out } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            sessionToken: sessionTokenRef.current,
            locationBias: {
              // viés para Orlando/FL — não restringe, apenas prioriza
              center: { lat: 28.5383, lng: -81.3792 },
              radius: 120000,
            },
          });
        if (cancelled) return;
        const mapped = (out || [])
          .map((s: any) => {
            const p = s.placePrediction;
            if (!p) return null;
            return {
              placeId: p.placeId,
              primary: p.mainText?.text || p.text?.text || "",
              secondary: p.secondaryText?.text || "",
            };
          })
          .filter(Boolean) as typeof suggestions;
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value]);

  const pick = (s: { primary: string; secondary: string }) => {
    const full = [s.primary, s.secondary].filter(Boolean).join(", ");
    onChange(full);
    setSuggestions([]);
    setOpen(false);
    sessionTokenRef.current = null; // encerra a sessão para faturamento por sessão
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 active:bg-muted transition-colors border-b border-border/40 last:border-b-0"
            >
              <div className="text-sm font-medium text-foreground line-clamp-1">
                {s.primary}
              </div>
              {s.secondary && (
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {s.secondary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
