import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarIcon, Clock, MapPin, Search, UserCheck, ChevronRight,
  ArrowRight, Check, X, Plane, Hotel, Building2,
  type LucideIcon,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { pt } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

/**
 * MobileSearch — Booking/Kayak inspired mobile search form.
 *
 * Visual language:
 * - 2 hero cards: "Local" (with optional secondary), "Quando" (dates + times together).
 * - All pickers are bottom sheets with proper headers and confirm CTAs.
 * - Single range calendar handles both dates at once (industry standard).
 * - Time pickers integrated into the same sheet as the calendar (collapsible row).
 */

const locations = [
  { name: "Aeroporto de Orlando (MCO)", icon: Plane, sub: "Terminal A · Retirada balcão" },
  { name: "Aeroporto de Miami (MIA)", icon: Plane, sub: "Terminal central" },
  { name: "Aeroporto de Tampa (TPA)", icon: Plane, sub: "Saguão de chegadas" },
  { name: "Aeroporto de Jacksonville (JAX)", icon: Plane, sub: "Terminal único" },
  { name: "Aeroporto de Fort Lauderdale (FLL)", icon: Plane, sub: "Terminal 1" },
  { name: "Aeroporto de Daytona Beach (DAB)", icon: Plane, sub: "Saguão principal" },
  { name: "Kissimmee", icon: Building2, sub: "Região central" },
  { name: "Orlando (Entrega no Hotel)", icon: Hotel, sub: "Entrega cortesia em hotéis" },
  { name: "Miami (Entrega no Hotel)", icon: Hotel, sub: "Entrega cortesia em hotéis" },
];

const timeSlots = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

interface Props {
  pickupLocation: string;
  returnLocation: string;
  setPickupLocation: (l: string) => void;
  setReturnLocation: (l: string) => void;
  differentReturnLocation: boolean;
  setDifferentReturnLocation: (v: boolean) => void;

  pickupDate: Date | undefined;
  returnDate: Date | undefined;
  setPickupDate: (d: Date | undefined) => void;
  setReturnDate: (d: Date | undefined) => void;

  pickupTime: string;
  returnTime: string;
  setPickupTime: (t: string) => void;
  setReturnTime: (t: string) => void;

  driverOver25: boolean;
  setDriverOver25: (v: boolean) => void;
  driverAge: string;
  setDriverAge: (s: string) => void;
  isUnderageBlocked: boolean;
  isYoungDriverFee: boolean;

  onSearch: () => void;
  errors: { pickup?: string; return?: string };
}

type Sheet = "loc-pickup" | "loc-return" | "dates" | null;

export default function MobileSearch(p: Props) {
  const [openSheet, setOpenSheet] = useState<Sheet>(null);

  // Date range for the unified calendar
  const range: DateRange | undefined = useMemo(
    () =>
      p.pickupDate || p.returnDate
        ? { from: p.pickupDate, to: p.returnDate }
        : undefined,
    [p.pickupDate, p.returnDate],
  );

  const days =
    p.pickupDate && p.returnDate
      ? Math.max(1, differenceInCalendarDays(p.returnDate, p.pickupDate))
      : 0;

  const datesLabel = (() => {
    if (p.pickupDate && p.returnDate) {
      return `${format(p.pickupDate, "dd MMM", { locale: pt })} → ${format(p.returnDate, "dd MMM", { locale: pt })}`;
    }
    if (p.pickupDate) return `${format(p.pickupDate, "dd MMM", { locale: pt })} → ...`;
    return "Selecione as datas";
  })();

  return (
    <div className="md:hidden">
      {/* ───────── Card 1. Localização ───────── */}
      <SectionCard>
        <FieldRow
          icon={MapPin}
          label="Retirada"
          value={p.pickupLocation || "Selecione o local"}
          empty={!p.pickupLocation}
          onClick={() => setOpenSheet("loc-pickup")}
        />
        <AnimatePresence initial={false}>
          {p.differentReturnLocation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <Divider />
              <FieldRow
                icon={MapPin}
                label="Devolução"
                value={p.returnLocation || "Selecione o local"}
                empty={!p.returnLocation}
                onClick={() => setOpenSheet("loc-return")}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <InlineToggle
          checked={p.differentReturnLocation}
          onChange={p.setDifferentReturnLocation}
          label="Devolver em outro local"
        />
        {(p.errors.pickup || p.errors.return) && (
          <p className="px-4 pb-3 -mt-1 text-[12px] text-destructive">
            {p.errors.pickup || p.errors.return}
          </p>
        )}
      </SectionCard>

      {/* ───────── Card 2. Datas + Horários ───────── */}
      <SectionCard className="mt-3">
        <button
          type="button"
          onClick={() => setOpenSheet("dates")}
          className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-muted/30 transition-colors"
        >
          <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarIcon size={18} className="text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
              Datas
            </p>
            <p className={cn(
              "text-[15px] font-semibold leading-tight mt-0.5 truncate",
              p.pickupDate ? "text-foreground" : "text-muted-foreground/70"
            )}>
              {datesLabel}
            </p>
            {days > 0 && (
              <p className="text-[11.5px] text-primary font-semibold mt-0.5">
                {days} {days === 1 ? "diária" : "diárias"}
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" />
        </button>
        <Divider />
        <div className="grid grid-cols-2">
          <TimeRow
            label="Retirada"
            value={p.pickupTime}
            onChange={p.setPickupTime}
          />
          <div className="border-l border-border/40">
            <TimeRow
              label="Devolução"
              value={p.returnTime}
              onChange={p.setReturnTime}
            />
          </div>
        </div>
      </SectionCard>

      {/* ───────── Driver age toggle ───────── */}
      <div className="mt-4 px-1">
        <div className="flex items-center gap-3">
          <Switch
            checked={p.driverOver25}
            onCheckedChange={p.setDriverOver25}
            className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted"
          />
          <UserCheck size={14} className="text-primary" />
          <span className="text-[12px] font-semibold text-foreground/85">
            Condutor tem 21 anos ou mais
          </span>
        </div>
        <AnimatePresence>
          {!p.driverOver25 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                <div className={cn(
                  "flex items-center gap-2 px-4 h-14 rounded-xl border bg-background/50",
                  p.isUnderageBlocked ? "border-destructive/60" : p.isYoungDriverFee ? "border-amber-500/50" : "border-primary/40"
                )}>
                  <UserCheck size={16} className={cn("shrink-0", p.isUnderageBlocked ? "text-destructive" : "text-primary")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
                      Idade do condutor
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="18"
                      max="99"
                      value={p.driverAge}
                      onChange={(e) => p.setDriverAge(e.target.value)}
                      placeholder="Ex: 22"
                      className="text-[15px] text-foreground bg-transparent outline-none w-full placeholder:text-muted-foreground/50"
                    />
                  </div>
                  {p.isYoungDriverFee && (
                    <span className="text-[10.5px] text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                      +8% diária
                    </span>
                  )}
                </div>
                {p.isUnderageBlocked && (
                  <p className="text-[12px] text-destructive px-1">
                    Não atendemos condutores menores de 21 anos.
                  </p>
                )}
                {p.isYoungDriverFee && (
                  <p className="text-[12px] text-amber-700 dark:text-amber-400 px-1">
                    Será aplicada a taxa de jovem condutor de +8% sobre a diária.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ───────── CTA ───────── */}
      <Button
        onClick={p.onSearch}
        disabled={p.isUnderageBlocked}
        className="gold-gradient text-primary-foreground font-bold uppercase tracking-[0.14em] h-14 w-full mt-4 rounded-xl hover:opacity-90 transition-opacity text-[13.5px] gap-2 disabled:opacity-40"
      >
        <Search size={18} />
        Buscar carros
      </Button>

      {/* ═══════════ SHEETS ═══════════ */}

      {/* Location pickers */}
      <LocationSheet
        open={openSheet === "loc-pickup"}
        onClose={() => setOpenSheet(null)}
        title="Local de retirada"
        current={p.pickupLocation}
        onSelect={(l) => { p.setPickupLocation(l); setOpenSheet(null); }}
      />
      <LocationSheet
        open={openSheet === "loc-return"}
        onClose={() => setOpenSheet(null)}
        title="Local de devolução"
        current={p.returnLocation}
        onSelect={(l) => { p.setReturnLocation(l); setOpenSheet(null); }}
      />

      {/* Unified date range sheet */}
      <DateRangeSheet
        open={openSheet === "dates"}
        onClose={() => setOpenSheet(null)}
        range={range}
        pickupTime={p.pickupTime}
        returnTime={p.returnTime}
        setPickupTime={p.setPickupTime}
        setReturnTime={p.setReturnTime}
        onSelect={(r) => {
          p.setPickupDate(r?.from);
          p.setReturnDate(r?.to);
        }}
      />
    </div>
  );
}

/* ═══════════════════ Building blocks ═══════════════════ */

function SectionCard({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card/80 overflow-hidden", className)}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border/40 mx-4" />;
}

function FieldRow({
  icon: Icon,
  label,
  value,
  empty,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  empty?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/30 transition-colors text-left"
    >
      <span className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
          {label}
        </p>
        <p
          className={cn(
            "text-[15px] font-semibold leading-tight mt-0.5 truncate",
            empty ? "text-muted-foreground/70" : "text-foreground",
          )}
        >
          {value}
        </p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground/60 shrink-0" />
    </button>
  );
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1.5 px-4 py-3 cursor-pointer text-center">
      <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Clock size={15} className="text-primary" />
      </span>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
        {label}
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent text-[14.5px] font-semibold text-foreground outline-none text-center tabular-nums cursor-pointer"
        >
          {timeSlots.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </label>

  );
}

function InlineToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="px-4 py-3 border-t border-border/40 flex items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted"
      />
      <span className="text-[12px] font-semibold text-foreground/85">{label}</span>
    </div>
  );
}

/* ─────────────── Sheets ─────────────── */

function LocationSheet({
  open,
  onClose,
  title,
  current,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  current: string;
  onSelect: (l: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[88vh] overflow-y-auto p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-2 text-left border-b border-border/40">
          <SheetTitle className="text-[17px] font-bold">{title}</SheetTitle>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Aeroportos e pontos de entrega
          </p>
        </SheetHeader>
        <div className="p-3 space-y-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {locations.map(({ name, icon: Icon, sub }) => {
            const active = current === name;
            return (
              <button
                key={name}
                onClick={() => onSelect(name)}
                className={cn(
                  "w-full text-left flex items-center gap-3 px-3 py-3.5 rounded-xl border transition-colors min-h-[64px]",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border/40 active:bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[14px] leading-tight", active ? "font-bold text-foreground" : "font-semibold text-foreground")}>
                    {name}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{sub}</p>
                </div>
                {active && <Check size={18} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DateRangeSheet({
  open,
  onClose,
  range,
  onSelect,
  pickupTime,
  returnTime,
  setPickupTime,
  setReturnTime,
}: {
  open: boolean;
  onClose: () => void;
  range: DateRange | undefined;
  onSelect: (r: DateRange | undefined) => void;
  pickupTime: string;
  returnTime: string;
  setPickupTime: (t: string) => void;
  setReturnTime: (t: string) => void;
}) {
  const days =
    range?.from && range?.to ? Math.max(1, differenceInCalendarDays(range.to, range.from)) : 0;
  const canConfirm = !!(range?.from && range?.to);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl h-[92vh] max-h-[92vh] p-0 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 pt-10 pb-3 border-b border-border/40">
          <div>
            <SheetTitle className="text-[17px] font-bold">Quando?</SheetTitle>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              {!range?.from
                ? "Selecione a data de retirada"
                : !range?.to
                  ? "Agora selecione a data de devolução"
                  : `${days} ${days === 1 ? "diária" : "diárias"} reservadas`}
            </p>
          </div>

          {/* Date summary chips */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <DateChip
              label="Retirada"
              date={range?.from}
              active={!range?.from || !range?.to}
            />
            <ArrowRight size={16} className="text-muted-foreground" />
            <DateChip
              label="Devolução"
              date={range?.to}
              active={!!range?.from && !range?.to}
            />
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="flex justify-center">
            <Calendar
              mode="range"
              selected={range}
              onSelect={onSelect}
              numberOfMonths={1}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              initialFocus
              className="pointer-events-auto"
            />
          </div>

          {/* Times. appear only after both dates set */}
          {canConfirm && (
            <div className="mt-3 mx-3 rounded-2xl border border-border/50 bg-card/70 overflow-hidden">
              <div className="grid grid-cols-2">
                <TimeRow label="Retirada" value={pickupTime} onChange={setPickupTime} />
                <div className="border-l border-border/40">
                  <TimeRow label="Devolução" value={returnTime} onChange={setReturnTime} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div
          className="border-t border-border/40 bg-background/95 backdrop-blur-md px-5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <div className="flex items-center gap-3">
            {canConfirm ? (
              <p className="text-[12.5px] text-foreground/80 flex-1">
                <span className="font-bold text-foreground">{days}</span>{" "}
                {days === 1 ? "diária" : "diárias"} · {pickupTime} → {returnTime}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted-foreground flex-1">
                Selecione retirada e devolução
              </p>
            )}
            <Button
              onClick={onClose}
              disabled={!canConfirm}
              className="gold-gradient text-primary-foreground font-bold uppercase tracking-[0.14em] h-11 px-6 rounded-xl text-[12.5px] disabled:opacity-40"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DateChip({
  label,
  date,
  active,
}: {
  label: string;
  date: Date | undefined;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        active
          ? "border-primary bg-primary/10"
          : date
            ? "border-border/50 bg-card/60"
            : "border-border/40 bg-muted/20",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
        {label}
      </p>
      <p
        className={cn(
          "text-[13.5px] font-bold leading-tight mt-0.5",
          date ? "text-foreground" : "text-muted-foreground/60",
        )}
      >
        {date ? format(date, "dd MMM yyyy", { locale: pt }) : ""}
      </p>
    </div>
  );
}
