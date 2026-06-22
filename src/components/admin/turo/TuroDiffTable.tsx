import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/formatName";
import type { Classification, FieldDiff, BookingSnapshot } from "@/lib/turo/diffEngine";
import { TuroVehicleMapper } from "./TuroVehicleMapper";

type FilterKey = "all" | "new" | "enrich" | "identical" | "cancelled_csv" | "unmapped" | "invalid";

const KIND_META: Record<string, { label: string; chip: string; bar: string }> = {
  new:           { label: "Nova",        chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  enrich:        { label: "Enriquecer",  chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",      bar: "bg-amber-500" },
  identical:     { label: "Em dia",      chip: "bg-muted text-muted-foreground",                          bar: "bg-muted-foreground/40" },
  cancelled_csv: { label: "Cancelada",   chip: "bg-red-500/10 text-red-600 dark:text-red-400",            bar: "bg-red-500" },
  unmapped:      { label: "Sem veículo", chip: "bg-orange-500/10 text-orange-700 dark:text-orange-400",   bar: "bg-orange-500" },
  invalid:       { label: "Inválida",    chip: "bg-destructive/10 text-destructive",                      bar: "bg-destructive" },
};

interface Props {
  classifications: Classification[];
  onToggleSelected: (idx: number, value: boolean) => void;
  onToggleField: (idx: number, field: keyof BookingSnapshot, value: boolean) => void;
  onVehicleMapped: (turoName: string, vehicleId: string) => void;
}

function fmtValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(v);
}

function FieldDiffRow({ diff, selected, onToggle }: { diff: FieldDiff; selected: boolean; onToggle: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 px-3 py-1.5 rounded-md hover:bg-muted/30 cursor-pointer text-xs">
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{diff.label}</span>
          {diff.protected && (
            <span className="text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">protegido</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
          <span className="line-through opacity-60 tabular-nums">{fmtValue(diff.currentValue)}</span>
          <span className="opacity-40">→</span>
          <span className="text-foreground tabular-nums font-medium">{fmtValue(diff.newValue)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">{diff.reason}</div>
      </div>
    </label>
  );
}

export function TuroDiffTable({ classifications, onToggleSelected, onToggleField, onVehicleMapped }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: classifications.length };
    for (const k of Object.keys(KIND_META)) c[k] = 0;
    for (const x of classifications) c[x.kind]++;
    return c;
  }, [classifications]);

  const filtered = useMemo(() => {
    return classifications
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => {
        if (filter !== "all" && c.kind !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          const blob = `${c.row.guestName} ${c.row.vehicleModel} ${c.row.reservationId}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
  }, [classifications, filter, search]);

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "new", label: "Novas" },
    { key: "enrich", label: "Enriquecer" },
    { key: "identical", label: "Em dia" },
    { key: "cancelled_csv", label: "Canceladas" },
    { key: "unmapped", label: "Sem veículo" },
    { key: "invalid", label: "Inválidas" },
  ];

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, veículo ou ID Turo..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 px-3 rounded-full text-[11px] font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {f.label} <span className="opacity-70 tabular-nums">({counts[f.key] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma reserva nesta categoria.
          </div>
        ) : filtered.map(({ c, idx }) => {
          const meta = KIND_META[c.kind];
          const canSelect = c.kind === "new" || c.kind === "enrich" || c.kind === "cancelled_csv";
          const isOpen = expanded.has(idx);
          const hasDetails = c.diffs.length > 0 || c.kind === "unmapped";

          return (
            <div key={c.row.reservationId} className="bg-card rounded-lg border border-border/60 overflow-hidden">
              <div className="flex">
                <div className={cn("w-1", meta.bar)} />
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start gap-3">
                    {canSelect && (
                      <input
                        type="checkbox"
                        checked={c.selected}
                        onChange={(e) => onToggleSelected(idx, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                      />
                    )}
                    {!canSelect && <div className="w-4 shrink-0" />}

                    <button
                      type="button"
                      onClick={() => hasDetails && toggleExpand(idx)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{formatPersonName(c.row.guestName)}</span>
                        <span className={cn("text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full", meta.chip)}>
                          {meta.label}
                        </span>
                        {c.existing?.booking_number && (
                          <span className="text-[10px] text-muted-foreground">#{c.existing.booking_number}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">Turo #{c.row.reservationId}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{c.row.vehicleModel}</span>
                        <span className="opacity-50">•</span>
                        <span className="tabular-nums">{c.row.pickupDate} → {c.row.returnDate}</span>
                        {c.row.totalEarnings != null && (
                          <>
                            <span className="opacity-50">•</span>
                            <span className="tabular-nums font-medium">${c.row.totalEarnings.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </button>

                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(idx)}
                        className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center shrink-0"
                        aria-label={isOpen ? "Recolher" : "Expandir"}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {isOpen && c.kind === "unmapped" && (
                    <div className="mt-3 pl-7 pr-1">
                      <div className="text-xs text-muted-foreground mb-2">
                        O veículo <span className="font-medium text-foreground">"{c.row.vehicleModel}"</span> ainda não foi vinculado a um carro da frota Zeus.
                      </div>
                      <TuroVehicleMapper
                        turoVehicleName={c.row.vehicleModel}
                        onMapped={(vid) => onVehicleMapped(c.row.vehicleModel, vid)}
                      />
                    </div>
                  )}

                  {isOpen && c.diffs.length > 0 && (
                    <div className="mt-2 pl-7 pr-1 space-y-0.5 border-t border-border/40 pt-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-3">
                        Campos a atualizar
                      </div>
                      {c.diffs.map((diff) => (
                        <FieldDiffRow
                          key={String(diff.field)}
                          diff={diff}
                          selected={c.selectedFields.has(diff.field)}
                          onToggle={(v) => onToggleField(idx, diff.field, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
