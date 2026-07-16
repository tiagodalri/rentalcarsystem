import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CAR_BRANDS, CarBrand, findBrandByName, searchBrands } from "@/data/carBrands";
import { inputCls } from "./types";

type Props = {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
};

const FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' fill='%23e5e5e5'/></svg>";

function BrandLogo({ brand, size = 18 }: { brand: CarBrand; size?: number }) {
  return (
    <img
      src={brand.logoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = FALLBACK;
      }}
    />
  );
}

export default function BrandAutocomplete({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  // query is what filters the list; independent from the committed `value`
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => findBrandByName(value), [value]);
  // While typing, filter by query. While just browsing (focused without typing), show full list.
  const results = useMemo(
    () => (isTyping && query ? searchBrands(query, 100) : CAR_BRANDS),
    [isTyping, query],
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Reset active highlight when results change
  useEffect(() => {
    if (!open) return;
    if (matched) {
      const idx = results.findIndex((r) => r.slug === matched.slug);
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      setActiveIdx(0);
    }
  }, [results, open, matched]);

  // Scroll active option into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const openBrowse = () => {
    setIsTyping(false);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const pick = (b: CarBrand) => {
    onChange(b.name);
    setIsTyping(false);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setIsTyping(false);
    setOpen(true);
    inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openBrowse();
      else setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && results[activeIdx]) {
        e.preventDefault();
        pick(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // What to show inside the input
  const displayValue = isTyping ? query : value;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {matched && !isTyping ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <BrandLogo brand={matched} size={18} />
          </div>
        ) : (
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        )}
        <input
          ref={inputRef}
          className={`${inputCls} pl-9 pr-16`}
          value={displayValue}
          onFocus={openBrowse}
          onClick={openBrowse}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setIsTyping(true);
            setOpen(true);
            onChange(v);
          }}
          onKeyDown={onKey}
          placeholder={placeholder ?? "Buscar marca…"}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={clear}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              tabIndex={-1}
              aria-label="Limpar marca"
              title="Limpar"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (open) setOpen(false);
              else openBrowse();
            }}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            tabIndex={-1}
            aria-label="Abrir lista de marcas"
          >
            <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border/60 bg-popover shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma marca encontrada. você pode digitar manualmente.
            </div>
          ) : (
            results.map((b, i) => {
              const isActive = i === activeIdx;
              const isSelected = matched?.slug === b.slug;
              return (
                <button
                  key={b.slug}
                  data-idx={i}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(b);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <div className="h-6 w-6 inline-flex items-center justify-center rounded bg-background/60 border border-border/30">
                    <BrandLogo brand={b} size={18} />
                  </div>
                  <span className="text-sm text-foreground flex-1 truncate">{b.name}</span>
                  {isSelected && <Check size={13} className="text-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
