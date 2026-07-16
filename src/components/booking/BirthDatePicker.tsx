import * as React from "react";
import { format, parse, getDaysInMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

interface BirthDatePickerProps {
  /** ISO yyyy-MM-dd */
  value: string;
  onChange: (iso: string) => void;
  /** Class for the trigger button */
  className?: string;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ITEM_H = 44; // px per wheel item. tuned for thumb-friendly tap

/**
 * Reusable iOS-style scroll-wheel column.
 * Centered selection with scroll-snap. Big-tech feel.
 */
function Wheel({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: string[];
  value: number; // index
  onChange: (idx: number) => void;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const programmaticRef = React.useRef(false);

  // Sync external value -> scroll position
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = value * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      programmaticRef.current = true;
      el.scrollTo({ top: target, behavior: "smooth" });
      window.setTimeout(() => (programmaticRef.current = false), 350);
    }
  }, [value]);

  const handleScroll = () => {
    if (programmaticRef.current) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (clamped !== value) onChange(clamped);
    }, 80);
  };

  return (
    <div
      className="relative flex-1 h-[220px] overflow-hidden"
      role="listbox"
      aria-label={ariaLabel}
    >
      {/* Center selection band */}
      <div
        className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 rounded-xl bg-primary/10 border border-primary/20"
        style={{ height: ITEM_H }}
      />
      {/* Top/bottom fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[88px] bg-gradient-to-b from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[88px] bg-gradient-to-t from-background to-transparent z-10" />

      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{
          scrollPaddingTop: ITEM_H * 2,
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
          scrollbarWidth: "none",
        }}
      >
        {items.map((label, i) => {
          const active = i === value;
          return (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "snap-center w-full flex items-center justify-center select-none transition-all duration-150",
                active
                  ? "text-foreground font-semibold text-lg"
                  : "text-muted-foreground/60 text-base"
              )}
              style={{ height: ITEM_H }}
              aria-selected={active}
              role="option"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BirthDatePicker({
  value,
  onChange,
  className,
  minYear = 1930,
  maxYear = new Date().getFullYear() - 18,
  placeholder = "Selecione a data",
}: BirthDatePickerProps) {
  const isMobile = useIsMobile();

  const currentDate = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  // ----- Mobile drawer state -----
  const [open, setOpen] = React.useState(false);
  const defaultDate = currentDate ?? new Date(1995, 0, 1);
  const [day, setDay] = React.useState(defaultDate.getDate() - 1);
  const [month, setMonth] = React.useState(defaultDate.getMonth());
  const [year, setYear] = React.useState(defaultDate.getFullYear() - minYear);

  // Resync on open
  React.useEffect(() => {
    if (!open) return;
    const base = currentDate ?? new Date(1995, 0, 1);
    setDay(base.getDate() - 1);
    setMonth(base.getMonth());
    setYear(base.getFullYear() - minYear);
  }, [open, currentDate, minYear]);

  const years = React.useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i)),
    [minYear, maxYear]
  );
  const selectedYear = minYear + year;
  const daysInMonth = getDaysInMonth(new Date(selectedYear, month, 1));
  const days = React.useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")),
    [daysInMonth]
  );

  // Clamp day if month/year shrinks
  React.useEffect(() => {
    if (day > daysInMonth - 1) setDay(daysInMonth - 1);
  }, [daysInMonth, day]);

  const handleConfirm = () => {
    const d = new Date(selectedYear, month, day + 1);
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  };

  const triggerLabel = currentDate
    ? format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: pt })
    : placeholder;

  const trigger = (
    <button
      type="button"
      onClick={() => isMobile && setOpen(true)}
      className={cn(
        "flex w-full items-center justify-between text-left",
        !currentDate && "text-muted-foreground/60",
        className
      )}
    >
      <span className="flex items-center gap-3">
        <CalendarIcon size={18} className="text-primary/70 shrink-0" />
        <span className="truncate">{triggerLabel}</span>
      </span>
      <ChevronDown size={16} className="text-muted-foreground/60 shrink-0" />
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="px-4 pb-safe">
            <DrawerHeader className="text-center pb-2">
              <DrawerTitle className="text-base font-semibold">
                Data de nascimento
              </DrawerTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Arraste para escolher dia, mês e ano
              </p>
            </DrawerHeader>

            <div className="relative flex items-stretch gap-2 px-2 mt-2">
              <Wheel
                items={days}
                value={day}
                onChange={setDay}
                ariaLabel="Dia"
              />
              <Wheel
                items={MONTHS_PT}
                value={month}
                onChange={setMonth}
                ariaLabel="Mês"
              />
              <Wheel
                items={years}
                value={year}
                onChange={setYear}
                ariaLabel="Ano"
              />
            </div>

            <DrawerFooter className="pt-4 pb-6">
              <Button
                onClick={handleConfirm}
                className="h-12 text-base font-semibold gap-2"
                size="lg"
              >
                <Check size={18} />
                Confirmar
              </Button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground py-2"
              >
                Cancelar
              </button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: popover + calendar
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
          }}
          captionLayout="dropdown-buttons"
          fromYear={minYear}
          toYear={maxYear}
          defaultMonth={currentDate || new Date(1995, 0)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
