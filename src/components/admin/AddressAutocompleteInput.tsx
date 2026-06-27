import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

type Suggestion = { placeId: string; primary: string; secondary: string };

/**
 * Address autocomplete via edge function `places-autocomplete`, que chama o
 * Google Places API (New) pelo connector gateway. Funciona em qualquer domínio
 * (custom domain, PWA, mobile) porque NÃO depende da chave browser/referrer.
 */
export function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = "Endereço (rua, número, cidade)",
  className,
  disabled,
  id,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
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
        const { data, error: fnErr } = await supabase.functions.invoke("places-autocomplete", {
          body: { input: q, sessionToken: sessionTokenRef.current },
        });
        if (cancelled) return;
        if (fnErr) throw fnErr;
        if ((data as any)?.error) throw new Error((data as any).error);
        const mapped: Suggestion[] = (data as any)?.suggestions || [];
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
        if (mapped.length === 0) setError("Nenhum endereço encontrado");
      } catch (e: any) {
        if (cancelled) return;
        console.error("[AddressAutocomplete] erro:", e);
        setSuggestions([]);
        setOpen(false);
        setError("Falha ao buscar sugestões. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value]);

  const pick = (s: Suggestion) => {
    const full = [s.primary, s.secondary].filter(Boolean).join(", ");
    onChange(full);
    setSuggestions([]);
    setOpen(false);
    setError(null);
    // Nova sessão p/ próxima busca (faturamento por sessão no Places API)
    sessionTokenRef.current = crypto.randomUUID();
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
          onPointerDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-3 hover:bg-muted/60 active:bg-muted transition-colors border-b border-border/40 last:border-b-0 min-h-[48px]"
            >
              <div className="text-sm font-medium text-foreground line-clamp-1">{s.primary}</div>
              {s.secondary && (
                <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{s.secondary}</div>
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
