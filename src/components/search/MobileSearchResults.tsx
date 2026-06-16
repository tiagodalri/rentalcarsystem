import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarIcon, MapPin, Clock, Users, Briefcase,
  Settings2, Fuel, Snowflake, DoorOpen, Shield, Gauge, Check,
  AlertTriangle, SlidersHorizontal, ArrowUpDown, Pencil,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import SearchBar from "@/components/SearchBar";

export interface MobileSearchVehicle {
  id: string;
  name: string;
  categoryKey: string;
  passengers: number;
  luggage?: number;
  transmission?: string;
  fuel?: string;
  doors?: number | null;
  coverImage: string;
  preparing?: boolean;
}

interface Props {
  vehicles: MobileSearchVehicle[];
  categoryLabels: Record<string, string>;
  availableCategories: string[];
  availableTransmissions: string[];
  selectedCategories: string[];
  setSelectedCategories: (a: string[]) => void;
  selectedTransmissions: string[];
  setSelectedTransmissions: (a: string[]) => void;
  minPassengers: number;
  setMinPassengers: (n: number) => void;
  minLuggage: number;
  setMinLuggage: (n: number) => void;
  sortBy: "recommended" | "price_asc" | "price_desc" | "passengers_desc";
  setSortBy: (s: "recommended" | "price_asc" | "price_desc" | "passengers_desc") => void;
  activeFiltersCount: number;
  clearFilters: () => void;
  availableCount: number;
  availabilityLoading: boolean;
  pickupDate: Date | null;
  returnDate: Date | null;
  pickupTime: string;
  pickupLocation: string;
  days: number;
  isUnavailable: (id: string) => boolean;
  getPricing: (v: MobileSearchVehicle) => {
    totalPrice: number;
    dailyDisplay: number;
  };
  toBRL: (usd: number) => string;
  detailUrlFor: (name: string) => string;
}

const SORT_LABEL: Record<Props["sortBy"], string> = {
  recommended: "Recomendado",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  passengers_desc: "Mais passageiros",
};

export default function MobileSearchResults(p: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const toggle = (arr: string[], v: string, setter: (a: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="lg:hidden">
      {/* ───── Top bar ───── */}
      <div
        className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <Link
            to="/"
            className="h-9 w-9 rounded-full bg-card/70 border border-border/40 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Voltar"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold leading-none">
              Resultados
            </p>
            <p className="text-[15px] font-bold leading-tight truncate mt-0.5">
              {p.availabilityLoading
                ? "Checando…"
                : `${p.availableCount} ${p.availableCount === 1 ? "carro disponível" : "carros disponíveis"}`}
            </p>
          </div>
        </div>

        {/* Trip summary chips */}
        {(p.pickupDate || p.pickupLocation) && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-full text-left px-4 pb-3"
          >
            <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 flex items-center gap-2.5 active:bg-card transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                {p.pickupDate && (
                  <div className="flex items-center gap-1.5 text-[12.5px] text-foreground/90 font-medium truncate">
                    <CalendarIcon size={12} className="text-primary shrink-0" />
                    <span className="truncate">
                      {format(p.pickupDate, "dd MMM", { locale: pt })}
                      {p.returnDate && ` → ${format(p.returnDate, "dd MMM", { locale: pt })}`}
                    </span>
                    <span className="text-primary font-semibold">· {p.days}d</span>
                    {p.pickupTime && (
                      <>
                        <Clock size={11} className="text-muted-foreground shrink-0 ml-1" />
                        <span className="text-muted-foreground">{p.pickupTime}</span>
                      </>
                    )}
                  </div>
                )}
                {p.pickupLocation && (
                  <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate">
                    <MapPin size={11} className="text-primary shrink-0" />
                    <span className="truncate">{p.pickupLocation}</span>
                  </div>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary shrink-0">
                <Pencil size={11} /> Editar
              </span>
            </div>
          </button>
        )}

        {/* Filter + sort bar */}
        <div className="px-4 pb-2.5 flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex-1 h-10 rounded-full border border-border/50 bg-card/60 active:bg-card flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-colors"
          >
            <SlidersHorizontal size={14} className="text-primary" />
            Filtros
            {p.activeFiltersCount > 0 && (
              <span className="ml-1 h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {p.activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSortOpen(true)}
            className="flex-1 h-10 rounded-full border border-border/50 bg-card/60 active:bg-card flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-colors px-2 min-w-0"
          >
            <ArrowUpDown size={14} className="text-primary shrink-0" />
            <span className="truncate">{SORT_LABEL[p.sortBy]}</span>
          </button>
        </div>
      </div>

      {/* ───── Results ───── */}
      <div className="px-4 py-4 flex flex-col gap-4">
        {p.vehicles.map((v, i) => {
          const { totalPrice, dailyDisplay } = p.getPricing(v);
          const unavailable = p.isUnavailable(v.id);
          const url = p.detailUrlFor(v.name);

          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.03 }}
              className={`relative rounded-2xl border bg-card/70 overflow-hidden ${
                unavailable ? "border-border/40 opacity-90" : "border-border/50"
              }`}
            >
              {/* Image */}
              <Link
                to={unavailable ? "/" : url}
                className="block relative aspect-[16/10] bg-muted/20 overflow-hidden"
              >
                <img
                  src={v.coverImage}
                  alt={v.name}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover ${
                    unavailable ? "grayscale opacity-70" : ""
                  }`}
                />
                {/* Gradient at the bottom so badge area is always readable */}
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  {unavailable ? (
                    <span className="inline-flex items-center gap-1 bg-black/70 text-white text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full backdrop-blur-sm">
                      <AlertTriangle size={10} strokeWidth={3} />
                      Indisponível
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/95 text-white text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full shadow-md">
                      <Check size={10} strokeWidth={3} />
                      Disponível
                    </span>
                  )}
                  {v.preparing && !unavailable && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full shadow-md">
                      Em preparo
                    </span>
                  )}
                </div>
              </Link>

              {/* Body */}
              <div className="px-4 pt-3 pb-4">
                <p className="text-[10px] text-primary font-bold uppercase tracking-[0.18em]">
                  {p.categoryLabels[v.categoryKey] || v.categoryKey}
                </p>
                <h3 className="text-[17px] font-black uppercase tracking-wide leading-tight mt-0.5">
                  {v.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ou similar da categoria
                </p>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-[12px] text-foreground/85">
                  <Spec icon={Users} label={`${v.passengers} passageiros`} />
                  {v.luggage != null && (
                    <Spec icon={Briefcase} label={`${v.luggage} ${v.luggage === 1 ? "mala" : "malas"}`} />
                  )}
                  {v.transmission && (
                    <Spec icon={Settings2} label={v.transmission === "Automatic" ? "Automático" : v.transmission} />
                  )}
                  {v.fuel && (
                    <Spec
                      icon={Fuel}
                      label={
                        v.fuel === "Gasoline" ? "Gasolina"
                        : v.fuel === "Electric" ? "Elétrico"
                        : v.fuel === "Hybrid" ? "Híbrido"
                        : v.fuel === "Diesel" ? "Diesel" : v.fuel
                      }
                    />
                  )}
                  {v.doors != null && <Spec icon={DoorOpen} label={`${v.doors} portas`} />}
                  <Spec icon={Snowflake} label="Ar-condicionado" />
                  <Spec icon={Gauge} label="KM livre" />
                  <Spec icon={Shield} label="Seguro básico" />
                </div>

                {/* Support */}
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check size={12} strokeWidth={3} className="shrink-0" />
                  Suporte em português 24/7
                </div>

                {/* Price + CTA */}
                {unavailable ? (
                  <div className="mt-4 rounded-xl bg-muted/30 border border-border/40 p-3.5">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} strokeWidth={3} /> Indisponível para o período
                    </p>
                    <p className="text-[11.5px] text-muted-foreground mt-1.5 leading-snug">
                      Este veículo já está reservado para essas datas.
                    </p>
                    <Link
                      to="/"
                      className="mt-3 block w-full text-center border border-border/60 text-foreground/85 py-3 rounded-xl text-[12px] font-bold uppercase tracking-[0.16em] active:bg-muted/40"
                    >
                      Mudar datas
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-muted/15 border border-border/40 p-3.5">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                          Total {p.days} {p.days === 1 ? "dia" : "dias"}
                        </p>
                        <p className="text-[22px] font-black gold-text leading-none mt-1 tabular-nums">
                          {p.toBRL(totalPrice)}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground mt-1 tabular-nums">
                          {p.toBRL(dailyDisplay)} <span className="opacity-70">/dia</span>
                        </p>
                      </div>
                    </div>
                    <Link
                      to={url}
                      className="mt-3 block w-full text-center gold-gradient text-primary-foreground py-3 rounded-xl text-[12.5px] font-bold uppercase tracking-[0.16em] active:opacity-85"
                    >
                      Efetuar Reserva
                    </Link>
                    <p className="text-[10px] text-muted-foreground/80 text-center mt-2 leading-snug">
                      Parcele em até 12x · Sem compromisso até confirmar
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {!p.availabilityLoading && p.vehicles.length === 0 && (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-8 text-center">
            <AlertTriangle size={26} className="text-primary mx-auto mb-3" />
            <h3 className="text-base font-bold mb-2">Nenhum carro disponível</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              {p.activeFiltersCount > 0
                ? "Nenhum veículo corresponde aos filtros. Ajuste-os ou limpe."
                : "Todos os veículos estão reservados nessas datas. Tente outras."}
            </p>
            {p.activeFiltersCount > 0 ? (
              <button
                onClick={p.clearFilters}
                className="inline-block gold-gradient text-primary-foreground px-5 py-3 rounded-xl text-[12px] font-bold uppercase tracking-[0.16em]"
              >
                Limpar filtros
              </button>
            ) : (
              <Link
                to="/"
                className="inline-block gold-gradient text-primary-foreground px-5 py-3 rounded-xl text-[12px] font-bold uppercase tracking-[0.16em]"
              >
                Mudar datas
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ───── Filters sheet ───── */}
      <MobileSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtros"
        description={
          p.activeFiltersCount > 0
            ? `${p.activeFiltersCount} ${p.activeFiltersCount === 1 ? "filtro ativo" : "filtros ativos"}`
            : "Refine sua busca"
        }
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => {
                p.clearFilters();
              }}
              className="flex-1 h-12 rounded-xl border border-border/50 text-[13px] font-bold uppercase tracking-[0.14em] active:bg-muted/30"
            >
              Limpar
            </button>
            <button
              onClick={() => setFiltersOpen(false)}
              className="flex-[2] h-12 rounded-xl gold-gradient text-primary-foreground text-[13px] font-bold uppercase tracking-[0.14em] active:opacity-85"
            >
              Ver resultados
            </button>
          </div>
        }
      >
        <div className="py-2 space-y-6">
          {/* Category */}
          <FilterGroup title="Categoria">
            <div className="grid grid-cols-2 gap-2">
              {p.availableCategories.map((cat) => {
                const active = p.selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggle(p.selectedCategories, cat, p.setSelectedCategories)}
                    className={`h-11 px-3 rounded-xl border text-[12.5px] font-medium text-left transition-colors ${
                      active
                        ? "bg-primary/15 border-primary text-foreground"
                        : "bg-card/40 border-border/50 text-foreground/80"
                    }`}
                  >
                    {p.categoryLabels[cat] || cat}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="Passageiros (mín.)">
            <Chips
              options={[0, 2, 4, 5, 7]}
              value={p.minPassengers}
              onChange={p.setMinPassengers}
              labelFor={(n) => (n === 0 ? "Todos" : `${n}+`)}
            />
          </FilterGroup>

          <FilterGroup title="Malas (mín.)">
            <Chips
              options={[0, 1, 2, 3, 4]}
              value={p.minLuggage}
              onChange={p.setMinLuggage}
              labelFor={(n) => (n === 0 ? "Todas" : `${n}+`)}
            />
          </FilterGroup>

          {p.availableTransmissions.length > 0 && (
            <FilterGroup title="Câmbio">
              <div className="flex flex-wrap gap-2">
                {p.availableTransmissions.map((tx) => {
                  const active = p.selectedTransmissions.includes(tx);
                  return (
                    <button
                      key={tx}
                      onClick={() =>
                        toggle(p.selectedTransmissions, tx, p.setSelectedTransmissions)
                      }
                      className={`h-10 px-4 rounded-full border text-[12.5px] font-medium transition-colors ${
                        active
                          ? "bg-primary/15 border-primary text-foreground"
                          : "bg-card/40 border-border/50 text-foreground/80"
                      }`}
                    >
                      {tx === "Automatic" ? "Automático" : tx}
                    </button>
                  );
                })}
              </div>
            </FilterGroup>
          )}
        </div>
      </MobileSheet>

      {/* ───── Sort sheet ───── */}
      <MobileSheet open={sortOpen} onOpenChange={setSortOpen} title="Ordenar por">
        <div className="py-1">
          {(Object.keys(SORT_LABEL) as Array<keyof typeof SORT_LABEL>).map((key) => {
            const active = p.sortBy === key;
            return (
              <button
                key={key}
                onClick={() => {
                  p.setSortBy(key);
                  setSortOpen(false);
                }}
                className="w-full flex items-center justify-between py-4 border-b border-border/30 last:border-b-0"
              >
                <span className={`text-[14.5px] ${active ? "font-bold text-foreground" : "text-foreground/85"}`}>
                  {SORT_LABEL[key]}
                </span>
                {active && <Check size={18} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </MobileSheet>

      {/* ───── Edit search sheet ───── */}
      <MobileSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Alterar busca"
        description="Datas, horário e local"
      >
        <div className="py-2 pb-4">
          <SearchBar />
        </div>
      </MobileSheet>
    </div>
  );
}

/* ───── Building blocks ───── */
function Spec({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <Icon size={13} className="text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
  labelFor: (n: number) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-10 min-w-[56px] px-4 rounded-full border text-[12.5px] font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/40 border-border/50 text-foreground/80"
            }`}
          >
            {labelFor(n)}
          </button>
        );
      })}
    </div>
  );
}
