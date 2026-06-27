import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
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
 * Address autocomplete usando Google Places API (New).
 * - Sugestões aparecem a partir de 2 caracteres
 * - Bias para Orlando/FL, escopo US (formato CircleLiteral)
 * - Em caso de erro, exibe mensagem discreta abaixo do input
 * - Suporta toque (onPointerDown) e mouseup pra evitar que o blur do input
 *   feche o dropdown antes do tap registrar no mobile.
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
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesLibRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, []);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const google = await loadGoogleMaps();
        if (!placesLibRef.current) {
          placesLibRef.current = await google.maps.importLibrary("places");
        }
        const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLibRef.current;
        if (!AutocompleteSuggestion) {
          throw new Error("Places API (New) indisponível — verifique a chave do Google Maps");
        }
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const { suggestions: out } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sessionTokenRef.current,
            // Formato CircleLiteral do Places API New
            locationBias: {
              center: { lat: 28.5383, lng: -81.3792 }, // Orlando/FL
              radius: 150000,
            },
            includedRegionCodes: ["us"],
            language: "pt-BR",
            region: "us",
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
        if (mapped.length === 0) {
          setError("Nenhum endereço encontrado");
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error("[AddressAutocomplete] erro ao buscar sugestões:", e);
        setSuggestions([]);
        setOpen(false);
        setError(e?.message?.includes("REQUEST_DENIED")
          ? "Chave do Google Maps sem permissão pra Places API neste domínio"
          : "Falha ao buscar sugestões. Tente novamente.");
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
    setError(null);
    sessionTokenRef.current = null; // encerra a sessão (faturamento por sessão)
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
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-[60] mt-1 w-full rounded-lg border border-border bg-popover shadow-xl overflow-hidden max-h-72 overflow-y-auto"
          // Bloqueia o blur do input antes do click registrar (iOS Safari).
          onPointerDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-3 hover:bg-muted/60 active:bg-muted transition-colors border-b border-border/40 last:border-b-0 min-h-[48px]"
            >
              <div className="text-sm font-medium text-foreground line-clamp-1">
                {s.primary}
              </div>
              {s.secondary && (
                <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {s.secondary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {error && !loading && !open && value.trim().length >= 2 && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle size={11} className="text-amber-500" />
          {error}
        </p>
      )}
    </div>
  );
}
