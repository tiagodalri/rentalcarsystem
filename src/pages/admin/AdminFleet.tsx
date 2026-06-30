import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Car, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import FleetKpiStrip from "@/components/admin/fleet/FleetKpiStrip";
import FleetToolbar, { FleetFilters } from "@/components/admin/fleet/FleetToolbar";
import FleetGrid, { FleetVehicleCard } from "@/components/admin/fleet/FleetGrid";
import FleetTable, { FleetTableVehicle } from "@/components/admin/fleet/FleetTable";
import { useRegisterFab } from "@/hooks/useAdminFab";
import { useConfirm } from "@/components/mobile/ConfirmSheet";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import MobileFleet from "./mobile/MobileFleet";

type Vehicle = FleetVehicleCard &
  FleetTableVehicle & {
    insurance_expiry: string | null;
    registration_expiry: string | null;
    listed_on_turo?: boolean | null;
  };

const VIEW_KEY = "admin.fleet.view";

const today = new Date();
const in30 = new Date(today.getTime() + 30 * 86400000);
const isExpiringSoon = (v: Vehicle) => {
  const ds = [v.insurance_expiry, v.registration_expiry].filter(Boolean) as string[];
  return ds.some((d) => {
    const dt = new Date(d);
    return dt >= today && dt <= in30;
  });
};

export default function AdminFleet() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobileApp();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">(
    (typeof localStorage !== "undefined" && (localStorage.getItem(VIEW_KEY) as any)) || "table",
  );
  const [filters, setFilters] = useState<FleetFilters>({
    search: "",
    status: "all",
    publication: "all",
    category: "all",
    turo: "all",
  });
  const [kpiKey, setKpiKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select(
        "id,name,license_plate,category,year,status,published,daily_price_usd,default_deposit_amount,default_franchise_amount,passengers,bags,transmission,image_url,photos,insurance_expiry,registration_expiry,listed_on_turo",
      )
      .is("deleted_at", null)
      .order("name");
    setVehicles((data || []) as unknown as Vehicle[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useRegisterFab({ icon: Plus, label: "Adicionar veículo", onClick: () => navigate("/admin/fleet/new") });
  const confirm = useConfirm();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {}
  }, [view]);

  const categories = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean))).sort(),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q) {
        const blob = `${v.name} ${v.category} ${v.license_plate || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filters.status !== "all" && v.status !== filters.status) return false;
      if (filters.publication === "published" && !v.published) return false;
      if (filters.publication === "hidden" && v.published) return false;
      if (filters.category !== "all" && v.category !== filters.category) return false;
      if (kpiKey === "expiring" && !isExpiringSoon(v)) return false;
      return true;
    });
  }, [vehicles, filters, kpiKey]);

  const onKpiClick = (key: string) => {
    if (key === "all") {
      setKpiKey(null);
      setFilters((f) => ({ ...f, status: "all", publication: "all" }));
      return;
    }
    if (key === "published") {
      setKpiKey("published");
      setFilters((f) => ({ ...f, status: "all", publication: "published" }));
      return;
    }
    if (key === "expiring") {
      setKpiKey(kpiKey === "expiring" ? null : "expiring");
      return;
    }
    setKpiKey(key);
    setFilters((f) => ({ ...f, status: key as any, publication: "all" }));
  };

  const togglePublished = async (v: { id: string; published: boolean }) => {
    const next = !v.published;
    const { error } = await supabase.from("vehicles").update({ published: next }).eq("id", v.id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: next ? "Publicado no site" : "Removido do site" });
    setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, published: next } : x)));
  };

  const deleteVehicle = async (id: string) => {
    const ok = await confirm({
      title: "Excluir este veículo?",
      description: "Ele será movido para a lixeira e poderá ser restaurado por um administrador.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("vehicles")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Veículo excluído", description: "Movido para a lixeira." });
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const inlineSave = async (id: string, patch: Partial<Vehicle>) => {
    const { error } = await supabase.from("vehicles").update(patch as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setVehicles((prev) => prev.map((v) => (v.id === id ? ({ ...v, ...patch } as Vehicle) : v)));
    toast({ title: "Atualizado" });
  };

  if (isMobile) return <MobileFleet />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="admin-h1 hidden lg:block">Frota</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vehicles.length} veículos cadastrados · {vehicles.filter((v) => v.published).length} publicados
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/fleet/new")}
          className="hidden lg:inline-flex gold-gradient text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Plus size={12} /> Adicionar veículo
        </button>
      </div>

      <FleetKpiStrip vehicles={vehicles} onFilter={onKpiClick} activeKey={kpiKey} />

      <FleetToolbar
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        view={view}
        setView={setView}
      />

      {loading ? (
        <CardGridSkeleton count={6} variant="fleet" />
      ) : filtered.length === 0 && vehicles.length > 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum veículo encontrado"
          description="Ajuste os filtros ou limpe a busca."
          actionLabel="Limpar filtros"
          onAction={() => {
            setFilters({ search: "", status: "all", publication: "all", category: "all" });
            setKpiKey(null);
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Nenhum veículo cadastrado"
          description="Adicione veículos à frota para começar a gerenciar disponibilidade e locações."
          actionLabel="Adicionar veículo"
          onAction={() => navigate("/admin/fleet/new")}
        />
      ) : view === "grid" ? (
        <FleetGrid vehicles={filtered} onTogglePublished={togglePublished} onDelete={deleteVehicle} />
      ) : (
        <FleetTable
          vehicles={filtered}
          onTogglePublished={togglePublished}
          onInlineSave={inlineSave}
          onDelete={deleteVehicle}
        />
      )}
    </div>
  );
}
