import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarRange, Car, Users, DollarSign, TrendingUp, Clock,
  CheckCircle2, Wrench, Gauge, Calculator, Percent,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

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
  totalRevenue: number;
  avgCostPerCar: number;
  roiPct: number | null;
}

type StatCard = {
  label: string;
  value: string | number;
  icon: typeof Car;
  color: string;
  onClick: () => void;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0, activeBookings: 0, pendingBookings: 0, totalCustomers: 0,
    totalVehicles: 0, availableVehicles: 0, maintenanceVehicles: 0, avgOdometer: 0,
    totalInvestment: 0, totalRevenue: 0, avgCostPerCar: 0, roiPct: null,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [bookings, vehicles, customers] = await Promise.all([
        supabase.from("bookings").select("*"),
        supabase.from("vehicles").select("*"),
        supabase.from("customers").select("id"),
      ]);

      const bList = bookings.data || [];
      const vList = vehicles.data || [];
      const cList = customers.data || [];

      const totalRevenue = bList.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
      const totalInvestment = vList.reduce((sum, v) => sum + (Number(v.purchase_price) || 0), 0);
      const vehiclesWithPurchase = vList.filter((v) => Number(v.purchase_price) > 0);
      const avgCostPerCar = vehiclesWithPurchase.length > 0
        ? totalInvestment / vehiclesWithPurchase.length
        : 0;
      const roiPct = totalInvestment > 0 ? (totalRevenue / totalInvestment) * 100 : null;

      const vehiclesWithOdo = vList.filter((v) => Number(v.current_odometer) > 0);
      const avgOdometer = vehiclesWithOdo.length > 0
        ? vehiclesWithOdo.reduce((s, v) => s + Number(v.current_odometer), 0) / vehiclesWithOdo.length
        : 0;

      setStats({
        totalBookings: bList.length,
        activeBookings: bList.filter((b) => b.status === "confirmed" || b.status === "active" || b.status === "in_progress").length,
        pendingBookings: bList.filter((b) => b.status === "pending").length,
        totalCustomers: cList.length,
        totalVehicles: vList.length,
        availableVehicles: vList.filter((v) => v.status === "available").length,
        maintenanceVehicles: vList.filter((v) => v.status === "maintenance" || v.status === "preparing").length,
        avgOdometer,
        totalInvestment,
        totalRevenue,
        avgCostPerCar,
        roiPct,
      });

      setRecentBookings(bList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8));
      setLoading(false);
    }
    load();
  }, []);

  const fmtUSD = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtNum = (n: number) => Math.round(n).toLocaleString("pt-BR");

  const goBookings = () => navigate("/admin/bookings");
  const goCustomers = () => navigate("/admin/customers");
  const goFleet = () => navigate("/admin/fleet");
  const goFinance = () => navigate("/admin/finance");

  const operationalCards: StatCard[] = [
    { label: "Reservas Totais", value: stats.totalBookings, icon: CalendarRange, color: "text-primary", onClick: goBookings },
    { label: "Ativas / Em Andamento", value: stats.activeBookings, icon: TrendingUp, color: "text-emerald-500", onClick: goBookings },
    { label: "Pendentes", value: stats.pendingBookings, icon: Clock, color: "text-yellow-500", onClick: goBookings },
    { label: "Clientes", value: stats.totalCustomers, icon: Users, color: "text-purple-400", onClick: goCustomers },
  ];

  const fleetCards: StatCard[] = [
    { label: "Total de Veículos", value: stats.totalVehicles, icon: Car, color: "text-blue-400", onClick: goFleet },
    { label: "Disponíveis", value: stats.availableVehicles, icon: CheckCircle2, color: "text-emerald-500", onClick: goFleet },
    { label: "Em Manutenção", value: stats.maintenanceVehicles, icon: Wrench, color: "text-yellow-500", onClick: goFleet },
    { label: "Km Média", value: `${fmtNum(stats.avgOdometer)} mi`, icon: Gauge, color: "text-foreground", onClick: goFleet },
  ];

  const financeCards: StatCard[] = [
    { label: "Investimento Total", value: fmtUSD(stats.totalInvestment), icon: DollarSign, color: "text-primary", onClick: goFleet },
    { label: "Receita Total", value: fmtUSD(stats.totalRevenue), icon: TrendingUp, color: "text-emerald-500", onClick: goFinance },
    { label: "Custo Médio/Carro", value: fmtUSD(stats.avgCostPerCar), icon: Calculator, color: "text-foreground", onClick: goFleet },
    {
      label: "ROI da Frota",
      value: stats.roiPct === null ? "—" : `${stats.roiPct.toFixed(1)}%`,
      icon: Percent,
      color: stats.roiPct !== null && stats.roiPct >= 100 ? "text-emerald-500" : "text-yellow-500",
      onClick: goFleet,
    },
  ];

  const renderCardGrid = (cards: StatCard[]) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          onClick={card.onClick}
          className="bg-card/80 border-border/30 hover:border-primary/30 hover:bg-card/95 transition-all duration-200 cursor-pointer"
        >
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-tight">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.color} opacity-50`} />
            </div>
            <p className={`text-xl font-bold tabular-nums ${card.color}`}>
              {loading ? "—" : card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const statusMap: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" },
    confirmed: { label: "Confirmada", className: "bg-blue-500/10 text-blue-500 border border-blue-500/20" },
    active: { label: "Ativa", className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" },
    in_progress: { label: "Em andamento", className: "bg-amber-500/10 text-amber-600 border border-amber-500/20" },
    completed: { label: "Concluída", className: "bg-muted text-muted-foreground border border-border/30" },
    cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border border-destructive/20" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema Zeus Rental Car</p>
      </div>

      {/* Bloco 1 — Operacional */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operacional</h2>
        {renderCardGrid(operationalCards)}
      </section>

      {/* Bloco 2 — Frota */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frota</h2>
        {renderCardGrid(fleetCards)}
      </section>

      {/* Bloco 3 — Financeiro */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</h2>
        {renderCardGrid(financeCards)}
      </section>

      {/* Recent bookings */}
      <Card className="bg-card/80 border-border/30">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/20">
            <h2 className="text-sm font-semibold text-foreground">Reservas Recentes</h2>
          </div>
          {loading ? (
            <div className="p-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : recentBookings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma reserva encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cliente</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Retirada</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Devolução</th>
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
                        <td className="px-5 py-3.5 text-foreground font-medium">{b.customer_name}</td>
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
