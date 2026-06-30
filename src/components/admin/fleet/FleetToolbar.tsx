import { Search, LayoutGrid, Table as TableIcon, X } from "lucide-react";

export type FleetFilters = {
  search: string;
  status: "all" | "available" | "rented" | "maintenance" | "unavailable";
  publication: "all" | "published" | "hidden";
  category: string; // "all" or specific
  turo: "all" | "listed" | "unlisted";
};

type Props = {
  filters: FleetFilters;
  setFilters: (f: FleetFilters) => void;
  categories: string[];
  view: "grid" | "table";
  setView: (v: "grid" | "table") => void;
};

const STATUS_OPTS = [
  { v: "all", label: "Todos os status" },
  { v: "available", label: "Disponível" },
  { v: "rented", label: "Alugado" },
  { v: "maintenance", label: "Manutenção" },
  { v: "unavailable", label: "Indisponível" },
] as const;

const PUB_OPTS = [
  { v: "all", label: "Publicação: Todos" },
  { v: "published", label: "Publicação: No site" },
  { v: "hidden", label: "Publicação: Oculto" },
] as const;

const TURO_OPTS = [
  { v: "all", label: "Turo: Todos" },
  { v: "listed", label: "Turo: Listados" },
  { v: "unlisted", label: "Turo: Não listados" },
] as const;

export default function FleetToolbar({ filters, setFilters, categories, view, setView }: Props) {
  const hasFilter =
    filters.search ||
    filters.status !== "all" ||
    filters.publication !== "all" ||
    filters.category !== "all" ||
    filters.turo !== "all";

  const reset = () =>
    setFilters({ search: "", status: "all", publication: "all", category: "all", turo: "all" });

  const selectCls =
    "h-9 px-3 rounded-lg border border-border/60 bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Buscar por nome, placa ou categoria..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value as FleetFilters["status"] })}
        className={selectCls}
      >
        {STATUS_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={filters.category}
        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        className={selectCls}
      >
        <option value="all">Todas categorias</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={filters.publication}
        onChange={(e) => setFilters({ ...filters, publication: e.target.value as FleetFilters["publication"] })}
        className={selectCls}
      >
        {PUB_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={filters.turo}
        onChange={(e) => setFilters({ ...filters, turo: e.target.value as FleetFilters["turo"] })}
        className={selectCls}
      >
        {TURO_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>

      {hasFilter && (
        <button
          onClick={reset}
          className="h-9 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1"
        >
          <X size={12} /> Limpar
        </button>
      )}

      <div className="ml-auto hidden lg:inline-flex rounded-lg border border-border/60 bg-background p-0.5">
        <button
          onClick={() => setView("grid")}
          className={`h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
            view === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          title="Visão em cards"
        >
          <LayoutGrid size={13} /> Cards
        </button>
        <button
          onClick={() => setView("table")}
          className={`h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
            view === "table" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          title="Visão em tabela"
        >
          <TableIcon size={13} /> Tabela
        </button>
      </div>
    </div>
  );
}
