import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X as XIcon } from "lucide-react";
import { SignedImage } from "@/components/admin/SignedImage";

export type LightboxItem = { url: string; label?: string };

interface Props {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

export function PhotoLightbox({ items, index, onClose, onIndexChange }: Props) {
  const [current, setCurrent] = useState(index);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => setCurrent(index), [index]);

  const go = useCallback(
    (delta: number) => {
      if (!items.length) return;
      const next = (current + delta + items.length) % items.length;
      setCurrent(next);
      onIndexChange?.(next);
    },
    [current, items.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!items.length) return null;
  const item = items[current];
  const multi = items.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between p-3 sm:p-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs sm:text-sm font-medium text-foreground bg-muted/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
          {item.label ? <span>{item.label} · </span> : null}
          <span className="tabular-nums text-muted-foreground">
            {current + 1} / {items.length}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Prev */}
      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="Anterior"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center shadow-lg z-10"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-full max-h-full p-10 sm:p-16 flex items-center justify-center"
        onClick={(e) => {
          // Tap right half = next, left half = prev (mobile-friendly)
          if (!multi) return;
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          go(x > rect.width / 2 ? 1 : -1);
        }}
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart == null) return;
          const dx = e.changedTouches[0].clientX - touchStart;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          setTouchStart(null);
        }}
      >
        <SignedImage
          key={item.url}
          value={item.url}
          alt={item.label || ""}
          className="max-w-[92vw] max-h-[80vh] rounded-xl shadow-2xl object-contain select-none"
        />
      </div>

      {/* Next */}
      {multi && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="Próxima"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center shadow-lg z-10"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Thumbnail strip */}
      {multi && (
        <div
          className="absolute bottom-3 sm:bottom-5 inset-x-0 flex justify-center z-10 px-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1.5 overflow-x-auto max-w-full bg-muted/70 backdrop-blur-sm p-1.5 rounded-xl">
            {items.map((it, i) => (
              <button
                key={it.url + i}
                onClick={() => {
                  setCurrent(i);
                  onIndexChange?.(i);
                }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-md overflow-hidden border-2 shrink-0 transition-all ${
                  i === current ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                aria-label={it.label || `Foto ${i + 1}`}
              >
                <SignedImage value={it.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
