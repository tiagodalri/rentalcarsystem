import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Filter, Star, AlertTriangle, MailOpen, Archive, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
// Calendar import removed: preset + native date inputs cover the UX for now.
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AdvancedFiltersState {
  unread: boolean;
  vip: boolean;
  urgent: boolean;
  archived: boolean;
  datePreset: DatePreset;
  customRange: { from: Date | null; to: Date | null };
}

export type DatePreset = "any" | "today" | "yesterday" | "7d" | "30d" | "custom";

export const DEFAULT_ADVANCED_FILTERS: AdvancedFiltersState = {
  unread: false,
  vip: false,
  urgent: false,
  archived: false,
  datePreset: "any",
  customRange: { from: null, to: null },
};

export function countActiveAdvancedFilters(s: AdvancedFiltersState): number {
  let n = 0;
  if (s.unread) n++;
  if (s.vip) n++;
  if (s.urgent) n++;
  if (s.archived) n++;
  if (s.datePreset !== "any") n++;
  return n;
}

/** Resolves the state into an inclusive [from, to] Date pair, or null if unbounded. */
export function resolveDateRange(s: AdvancedFiltersState): { from: Date; to: Date } | null {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  switch (s.datePreset) {
    case "any":
      return null;
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "custom": {
      if (!s.customRange.from || !s.customRange.to) return null;
      return { from: startOfDay(s.customRange.from), to: endOfDay(s.customRange.to) };
    }
  }
}

interface ToggleRowProps {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}
function ToggleRow({ active, onToggle, icon, label, hint }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-sm transition-colors",
        active ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground/80",
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {hint && <span className="text-[10px] text-muted-foreground shrink-0">{hint}</span>}
      <span
        className={cn(
          "w-4 h-4 rounded border shrink-0 flex items-center justify-center",
          active ? "bg-primary border-primary text-primary-foreground" : "border-border/60",
        )}
      >
        {active && <Check className="w-3 h-3" />}
      </span>
    </button>
  );
}

export function AdvancedFiltersButton({
  value,
  onChange,
}: {
  value: AdvancedFiltersState;
  onChange: (v: AdvancedFiltersState) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = useMemo(() => countActiveAdvancedFilters(value), [value]);

  function patch(p: Partial<AdvancedFiltersState>) {
    onChange({ ...value, ...p });
  }
  function setPreset(p: DatePreset) {
    patch({ datePreset: p });
  }

  const dateLabel: Record<DatePreset, string> = {
    any: "Qualquer data",
    today: "Hoje",
    yesterday: "Ontem",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    custom: "Personalizado",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-9 px-2.5 text-xs gap-1.5 shrink-0"
          title="Filtros avançados"
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] border-0">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="flex items-center justify-between px-1 py-1 mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Filtros
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
              onClick={() => onChange(DEFAULT_ADVANCED_FILTERS)}
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          <ToggleRow
            active={value.unread}
            onToggle={() => patch({ unread: !value.unread })}
            icon={<MailOpen className="w-4 h-4" />}
            label="Não lidas"
          />
          <ToggleRow
            active={value.vip}
            onToggle={() => patch({ vip: !value.vip })}
            icon={<Star className="w-4 h-4" />}
            label="VIP"
          />
          <ToggleRow
            active={value.urgent}
            onToggle={() => patch({ urgent: !value.urgent })}
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Urgentes"
          />
          <ToggleRow
            active={value.archived}
            onToggle={() => patch({ archived: !value.archived })}
            icon={<Archive className="w-4 h-4" />}
            label="Arquivadas"
            hint="mostrar"
          />
        </div>

        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-1 flex items-center gap-1.5">
            <CalendarIcon className="w-3 h-3" /> Última mensagem
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(["any", "today", "yesterday", "7d", "30d", "custom"] as DatePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={cn(
                  "text-xs h-8 rounded-md px-2 transition-colors",
                  value.datePreset === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 hover:bg-muted/70 text-foreground",
                )}
              >
                {dateLabel[p]}
              </button>
            ))}
          </div>
          {value.datePreset === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">De</div>
                <Input
                  type="date"
                  value={value.customRange.from ? toInputDate(value.customRange.from) : ""}
                  onChange={(e) =>
                    patch({
                      customRange: {
                        ...value.customRange,
                        from: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null,
                      },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Até</div>
                <Input
                  type="date"
                  value={value.customRange.to ? toInputDate(value.customRange.to) : ""}
                  onChange={(e) =>
                    patch({
                      customRange: {
                        ...value.customRange,
                        to: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null,
                      },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toInputDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

