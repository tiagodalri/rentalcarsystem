import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Car, X } from "lucide-react";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { coverImageMap } from "@/data/fleetAssets";

/* ============================================================
   FROTA. Mobile-first
   Grid 2 colunas com imagens, filtro segmented, busca.
   ============================================================ */

type Vehicle = {
  id: string;
  name: string;
  license_plate: string | null;
  status: string;
  published: boolean;
  daily_price_usd: number | null;
  category: string | null;
  image_url: string | null;
  listed_on_turo: boolean | null;
};

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  rented: "bg-blue-500",
  maintenance: "bg-amber-500",
  preparing: "bg-sky-500",
};

type Filter = "all" | "available" | "rented" | "maintenance";
type TuroFilter = "all" | "listed" | "unlisted";

export default function MobileFleet() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [turoFilter, setTuroFilter] = useState<TuroFilter>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("id, name, license_plate, status, published, daily_price_usd, category, image_url, listed_on_turo")
      .is("deleted_at", null)
      .order("name");
    setItems((data as Vehicle[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((v) => {
    if (filter !== "all" && v.status !== filter) return false;
    if (turoFilter === "listed" && !v.listed_on_turo) return false;
    if (turoFilter === "unlisted" && v.listed_on_turo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${v.name} ${v.license_plate || ""} ${v.category || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, filter, turoFilter, search]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-28">
        <div className="px-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {items.length} veículos · {items.filter((v) => v.published).length} publicados
          </p>


          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar veículo, placa"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-3">
            <SegmentedControl
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "all", label: "Todos" },
                { value: "available", label: "Disp." },
                { value: "rented", label: "Alug." },
                { value: "maintenance", label: "Manut." },
              ]}
            />
          </div>

          <div className="mt-2">
            <SegmentedControl
              value={turoFilter}
              onChange={(v) => setTuroFilter(v as TuroFilter)}
              options={[
                { value: "all", label: "Tudo" },
                { value: "listed", label: "Na Turo" },
                { value: "unlisted", label: "Particular" },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 px-4 grid grid-cols-2 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-xl bg-muted animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-sm text-muted-foreground">Nenhum veículo.</div>
          ) : filtered.map((v) => {
            const img = (coverImageMap as any)[v.name] || v.image_url || "";
            return (
              <button
                key={v.id}
                onClick={() => navigate(`/admin/fleet/${v.id}`)}
                className="text-left bg-card rounded-xl border border-border/50 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {img ? (
                    <img src={img} alt={v.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                      <Car size={28} />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/85 backdrop-blur-md text-[11px] font-medium shadow-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[v.status] || "bg-muted-foreground"}`} />
                    {v.status === "available" ? "Disponível" : v.status === "rented" ? "Alugado" : v.status === "maintenance" ? "Manutenção" : v.status}
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-[13px] font-semibold leading-tight truncate">{v.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate leading-tight">
                    {v.license_plate || v.category || ""}
                  </div>
                  {v.daily_price_usd != null && (
                    <div className="text-sm font-semibold pt-1 tabular-nums leading-none">
                      ${Math.round(v.daily_price_usd)}<span className="text-[10px] text-muted-foreground font-normal ml-0.5">/dia</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </PullToRefresh>
  );
}
