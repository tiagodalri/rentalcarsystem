import { formatPersonName } from "@/lib/formatName";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarRange, Car, Users, DollarSign, TrendingUp, Clock,
  CheckCircle2, Wrench, Gauge, Calculator, Percent,
  CalendarClock, AlertCircle, Receipt, FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { calcRoiPct, sumTotalRevenue } from "@/lib/fleetMetrics";

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
  monthlyRevenue: number;
  avgCostPerCar: number;
  roiPct: number | null;
  avgTicket: number | null;
  occupancyRate: number | null;
  returnsToday: number;
  pendingOver24h: number;
  maintenanceOverdue: number;
  expiredLicenses: number;
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
    totalInvestment: 0, monthlyRevenue: 0, avgCostPerCar: 0, roiPct: null,
    avgTicket: null, occupancyRate: null,
    returnsToday: 0, pendingOver24h: 0, maintenanceOverdue: 0, expiredLicenses: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const periodAnchor = periodMonth ?? new Date();
  const periodKey = `${periodAnchor.getFullYear()}-${periodAnchor.getMonth()}`;

  useEffect(() => {
    async function load() {
      const [bookings, vehicles, customers] = await Promise.all([
        supabase.from("bookings").select("id, status, created_at, return_date, total_price, customer_name, customer_email, vehicle_id, pickup_date").order("created_at", { ascending: false }).limit(500),
        supabase.from("vehicles").select("id, name, status, purchase_price, current_odometer, next_service_km"),
        supabase.from("customers").select("id, driver_license_expiry"),
      ]);

      const bList = bookings.data || [];
      const vList = vehicles.data || [];
      const cList = customers.data || [];

      // Period revenue (selected month — defaults to current)
      const now = new Date();
      const monthStart = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth(), 1);
      const monthEnd = new Date(periodAnchor.getFullYear(), periodAnchor.getMonth() + 1, 0, 23, 59, 59);
      const revenueStatuses = ["confirmed", "in_progress", "completed"];
      const monthlyBookings = bList.filter(b => {
        const created = new Date(b.created_at);
        return revenueStatuses.includes(b.status) && created >= monthStart && created <= monthEnd;
      });
      const monthlyRevenue = monthlyBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

      // Avg ticket
      const completedBookings = bList.filter(b => b.status === "completed" && Number(b.total_price) > 0);
      const avgTicket = completedBookings.length > 0
        ? completedBookings.reduce((s, b) => s + Number(b.total_price), 0) / completedBookings.length
        : null;

      // Occupancy rate via RPC
      let occupancyRate: number | null = null;
      try {
        const { data: occData } = await supabase.rpc("get_occupancy_rate" as any);
        if (occData !== null && occData !== undefined) {
          occupancyRate = Number(occData);
        }
      } catch {
        // fallback
      }

      const totalInvestment = vList.reduce((sum, v) => sum + (Number(v.purchase_price) || 0), 0);
      const vehiclesWithPurchase = vList.filter((v) => Number(v.purchase_price) > 0);
      const avgCostPerCar = vehiclesWithPurchase.length > 0
        ? totalInvestment / vehiclesWithPurchase.length
        : 0;
      const totalRevenueAll = sumTotalRevenue(bList);
      const roiPct = calcRoiPct(totalRevenueAll, 0, totalInvestment);

      const vehiclesWithOdo = vList.filter((v) => Number(v.current_odometer) > 0);
      const avgOdometer = vehiclesWithOdo.length > 0
        ? vehiclesWithOdo.reduce((s, v) => s + Number(v.current_odometer), 0) / vehiclesWithOdo.length
        : 0;

      // Operational alerts
      const todayStr = now.toISOString().slice(0, 10);
      const returnsToday = bList.filter(b =>
        b.return_date === todayStr && ["confirmed", "in_progress"].includes(b.status)
      ).length;

      const twentyFourAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const pendingOver24h = bList.filter(b =>
        b.status === "pending" && new Date(b.created_at) < twentyFourAgo
      ).length;

      // Maintenance overdue: vehicles where current_odometer >= next_service_km
      const maintenanceOverdue = vList.filter(v =>
        v.next_service_km != null && v.current_odometer != null && Number(v.current_odometer) >= Number(v.next_service_km)
      ).length;

      // Expired driver licenses
      const todayDate = todayStr;
      const expiredLicenses = cList.filter((c: any) =>
        c.driver_license_expiry && c.driver_license_expiry < todayDate
      ).length;

      // Period bookings count (created_at within selected month) — useful for monthly closing
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
        monthlyRevenue,
        avgCostPerCar,
        roiPct,
        avgTicket,
        occupancyRate,
        returnsToday,
        pendingOver24h,
        maintenanceOverdue,
        expiredLicenses,
      });

      setRecentBookings(bList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8));
      setLoading(false);
    }
    load();
  }, [periodKey]);

  const fmtUSD = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtUSD2 = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtNum = (n: number) => Math.round(n).toLocaleString("pt-BR");

  const goBookings = () => navigate("/admin/bookings");
  const goCustomers = () => navigate("/admin/customers");
  const goFleet = () => navigate("/admin/fleet");
  const goFinance = () => navigate("/admin/finance");

  const showFinancial = hasAny(["admin", "finance"]);
  const showAlerts = hasAny(["admin", "operations", "support"]);

  const operationalCards: StatCard[] = [
    { label: "Reservas no Período", value: stats.totalBookings, icon: CalendarRange, color: "text-primary", onClick: goBookings },
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
    { label: "Receita do Período", value: fmtUSD(stats.monthlyRevenue), icon: TrendingUp, color: "text-emerald-500", onClick: goFinance },
    { label: "Ticket Medio", value: stats.avgTicket !== null ? fmtUSD2(stats.avgTicket) : "—", icon: Receipt, color: "text-foreground", onClick: goFinance },
    {
      label: "Taxa de Ocupacao",
      value: stats.occupancyRate !== null ? `${stats.occupancyRate}%` : "—",
      icon: Percent,
      color: stats.occupancyRate !== null && stats.occupancyRate >= 60 ? "text-emerald-500" : "text-yellow-500",
      onClick: goFleet,
    },
    { label: "Custo Medio/Carro", value: fmtUSD(stats.avgCostPerCar), icon: Calculator, color: "text-foreground", onClick: goFleet },
    {
      label: "ROI da Frota",
      value: stats.roiPct === null ? "—" : `${stats.roiPct.toFixed(1)}%`,
      icon: Percent,
      color: stats.roiPct !== null && stats.roiPct >= 100 ? "text-emerald-500" : "text-yellow-500",
      onClick: goFleet,
    },
  ];

  const renderCardGrid = (cards: StatCard[], cols = "grid-cols-2 lg:grid-cols-4") => (
    <div className={`grid ${cols} gap-4`}>
      {cards.map((card) => (
        <Card
          key={card.label}
          onClick={card.onClick}
          className="bg-card/80 border-border/30 hover:border-primary/30 hover:bg-card/95 transition-all duration-200 cursor-pointer"
        >
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="admin-label leading-tight">{card.label}</p>
              <card.icon className={`h-3.5 w-3.5 ${card.color} opacity-60`} strokeWidth={1.75} />
            </div>
            <p className={`admin-kpi ${card.color}`}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const alertCards = [
    {
      label: "Devolucoes Hoje",
      value: stats.returnsToday,
      icon: CalendarClock,
      onClick: () => navigate("/admin/bookings"),
    },
    {
      label: "Pendentes >24h",
      value: stats.pendingOver24h,
      icon: AlertCircle,
      onClick: () => navigate("/admin/bookings"),
    },
    {
      label: "Manutencao Atrasada",
      value: stats.maintenanceOverdue,
      icon: Wrench,
      onClick: () => navigate("/admin/fleet"),
    },
    {
      label: "CNH Vencida",
      value: stats.expiredLicenses,
      icon: FileText,
      onClick: () => navigate("/admin/customers"),
    },
  ];

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
        <div>
          <h1 className="admin-h1">Dashboard</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Visão geral do sistema Zeus Rental Car</p>
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

      {/* Bloco 3 — Financeiro */}
      {showFinancial && (
        <section className="space-y-3">
          <h2 className="admin-section-title">Financeiro</h2>
          {renderCardGrid(financeCards, "grid-cols-2 lg:grid-cols-3")}
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
                        <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{new Date(b.pickup_date).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{new Date(b.return_date).toLocaleDateString("pt-BR")}</td>
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
