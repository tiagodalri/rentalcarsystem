import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
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
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => findBrandByName(value), [value]);
  const results = useMemo(() => searchBrands(value, 50), [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => setActiveIdx(0), [value]);

  const pick = (b: CarBrand) => {
    onChange(b.name);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
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

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {matched ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <BrandLogo brand={matched} size={18} />
          </div>
        ) : (
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        )}
        <input
          className={`${inputCls} pl-9 pr-8`}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKey}
          placeholder={placeholder ?? "Ex: Toyota"}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          tabIndex={-1}
          aria-label="Abrir lista de marcas"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border/60 bg-popover shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma marca encontrada — você pode digitar manualmente.
            </div>
          ) : (
            results.map((b, i) => {
              const isActive = i === activeIdx;
              const isSelected = matched?.slug === b.slug;
              return (
                <button
                  key={b.slug}
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
          <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground bg-muted/30">
            {CAR_BRANDS.length} marcas disponíveis • use ↑ ↓ ⏎
          </div>
        </div>
      )}
    </div>
  );
}
