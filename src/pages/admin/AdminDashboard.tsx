import { formatPersonName } from "@/lib/formatName";
import { parseDateOnly } from "@/lib/dateOnly";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/KpiCard";
import { AdminKpiGrid } from "@/components/admin/layout/AdminPage";
import {
  Car, Users, DollarSign, TrendingUp, Clock,
  CheckCircle2, Wrench, Gauge, Calculator,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface DashboardStats {
  totalBookings: number;
  activeBookings: number;
  pendingBookings: number;
  totalCustomers: number;
  totalVehicles: number;
  availableVehicles: number;
  maintenanceVehicles: number;
  avgOdometer: number;
  totalInvestment: number;
  avgCostPerCar: number;
}

type StatCard = {
  label: string;
  value: string | number;
  icon: typeof Car;
  color: string;
  onClick: () => void;
};

interface AdminDashboardProps {
  periodMonth?: Date;
  embedded?: boolean;
}

export default function AdminDashboard({ periodMonth, embedded = false }: AdminDashboardProps = {}) {
  const navigate = useNavigate();
  const { hasAny } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0, activeBookings: 0, pendingBookings: 0, totalCustomers: 0,
    totalVehicles: 0, availableVehicles: 0, maintenanceVehicles: 0, avgOdometer: 0,
    totalInvestment: 0, avgCostPerCar: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const periodAnchor = periodMonth ?? new Date();
  const periodKey = `${periodAnchor.getFullYear()}-${periodAnchor.getMonth()}`;

  useEffect(() => {
    async function load() {
      const [bookings, vehicles, customers] = await Promise.all([
        supabase.from("bookings").select("id, status, created_at, return_date, total_price, customer_name, customer_email, vehicle_id, pickup_date").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
        supabase.from("vehicles").select("id, name, status, purchase_price, current_odometer").is("deleted_at", null),
        supabase.from("customers").select("id"),
      ]);

      const bList = bookings.data || [];
      const vList = vehicles.data || [];
      const cList = customers.data || [];

      // Period window (selected month — defaults to current)
      const monthStart = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), 1);
      const monthEnd = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth() + 1, 0, 23, 59, 59);

      const totalInvestment = vList.reduce((sum, v) => sum + (Number(v.purchase_price) || 0), 0);
      const vehiclesWithPurchase = vList.filter((v) => Number(v.purchase_price) > 0);
      const avgCostPerCar = vehiclesWithPurchase.length > 0
        ? totalInvestment / vehiclesWithPurchase.length
        : 0;

      const vehiclesWithOdo = vList.filter((v) => Number(v.current_odometer) > 0);
      const avgOdometer = vehiclesWithOdo.length > 0
        ? vehiclesWithOdo.reduce((s, v) => s + Number(v.current_odometer), 0) / vehiclesWithOdo.length
        : 0;

      // Period bookings count (created_at within selected month)
      const periodBookingsCount = bList.filter(b => {
        const created = new Date(b.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length;

      setStats({
        totalBookings: periodBookingsCount,
        activeBookings: bList.filter((b) => b.status === "confirmed" || b.status === "active" || b.status === "in_progress").length,
        pendingBookings: bList.filter((b) => b.status === "pending").length,
        totalCustomers: cList.length,
        totalVehicles: vList.length,
        availableVehicles: vList.filter((v) => v.status === "available").length,
        maintenanceVehicles: vList.filter((v) => v.status === "maintenance" || v.status === "preparing").length,
        avgOdometer,
        totalInvestment,
        avgCostPerCar,
      });

      setRecentBookings(bList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8));
      setLoading(false);
    }
    load();
  }, [periodKey]);

  const fmtUSD = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtNum = (n: number) => Math.round(n).toLocaleString("pt-BR");

  const goBookings = () => navigate("/admin/bookings");
  const goCustomers = () => navigate("/admin/customers");
  const goFleet = () => navigate("/admin/fleet");

  const showFinancial = hasAny(["admin", "finance"]);

  const operationalCards: StatCard[] = [
    { label: "Ativas / Em Andamento", value: stats.activeBookings, icon: TrendingUp, color: "text-emerald-500", onClick: goBookings },
    { label: "Pendentes", value: stats.pendingBookings, icon: Clock, color: "text-yellow-500", onClick: goBookings },
    { label: "Clientes", value: stats.totalCustomers, icon: Users, color: "text-purple-400", onClick: goCustomers },
  ];

  const fleetCards: StatCard[] = [
    { label: "Total de Veiculos", value: stats.totalVehicles, icon: Car, color: "text-blue-400", onClick: goFleet },
    { label: "Disponiveis", value: stats.availableVehicles, icon: CheckCircle2, color: "text-emerald-500", onClick: goFleet },
    { label: "Em Manutencao", value: stats.maintenanceVehicles, icon: Wrench, color: "text-yellow-500", onClick: goFleet },
    { label: "Milhas Média", value: `${fmtNum(stats.avgOdometer)} mi`, icon: Gauge, color: "text-foreground", onClick: goFleet },
  ];

  const financeCards: StatCard[] = [
    { label: "Investimento Total", value: fmtUSD(stats.totalInvestment), icon: DollarSign, color: "text-primary", onClick: goFleet },
    { label: "Custo Medio/Carro", value: fmtUSD(stats.avgCostPerCar), icon: Calculator, color: "text-foreground", onClick: goFleet },
  ];

  const renderCardGrid = (cards: StatCard[], cols: 2 | 3 | 4 = 4) => (
    <AdminKpiGrid cols={cols}>
      {cards.map((card) => (
        <button
          type="button"
          key={card.label}
          onClick={card.onClick}
          className="h-full w-full text-left"
        >
          <KpiCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            valueClassName={card.color}
            className="bg-card/80 border-border/30 hover:border-primary/30 hover:bg-card/95 transition-all duration-200 cursor-pointer h-full"
          />
        </button>
      ))}
    </AdminKpiGrid>
  );

  const statusMap: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" },
    confirmed: { label: "Confirmada", className: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
    active: { label: "Ativa", className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" },
    in_progress: { label: "Em andamento", className: "bg-amber-500/10 text-amber-600 border border-amber-500/20" },
    completed: { label: "Concluida", className: "bg-muted text-muted-foreground border border-border/30" },
    cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border border-destructive/20" },
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      {!embedded && (
        <div className="hidden lg:block">
          <h1 className="admin-h1">Dashboard</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Visão geral do sistema Sua Marca</p>
        </div>
      )}

      {/* Bloco 1 — Operacional */}
      <section className="space-y-3">
        <h2 className="admin-section-title">Operacional</h2>
        {renderCardGrid(operationalCards)}
      </section>

      {/* Bloco 2 — Frota */}
      <section className="space-y-3">
        <h2 className="admin-section-title">Frota</h2>
        {renderCardGrid(fleetCards)}
      </section>

      {/* Bloco 3 — Investimento (apenas indicadores únicos da Visão Geral) */}
      {showFinancial && (
        <section className="space-y-3">
          <h2 className="admin-section-title">Investimento</h2>
          {renderCardGrid(financeCards, 2)}
        </section>
      )}


      {/* Recent bookings */}
      <Card className="bg-card/80 border-border/30">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/20">
            <h2 className="text-sm font-semibold text-foreground">Reservas Recentes</h2>
          </div>
          {recentBookings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma reserva encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cliente</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Retirada</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Devolucao</th>
                    <th className="px-5 py-3 text-right text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Valor</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => {
                    const st = statusMap[b.status] || { label: b.status, className: "bg-muted text-muted-foreground border border-border/30" };
                    return (
                      <tr
                        key={b.id}
                        onClick={() => navigate(`/admin/bookings/${b.id}`)}
                        className="border-b border-border/10 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-foreground font-medium">{formatPersonName(b.customer_name)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{parseDateOnly(b.return_date).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3.5 text-foreground font-medium text-right tabular-nums">${b.total_price?.toFixed(2) || "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] px-2 py-1 rounded-md font-semibold ${st.className}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
