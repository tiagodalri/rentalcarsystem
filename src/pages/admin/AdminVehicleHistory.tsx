import { formatPersonName } from "@/lib/formatName";
import { parseDateOnly } from "@/lib/dateOnly";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Loader2, Car, DollarSign, Gauge, Calendar,
  Users, TrendingUp, Fuel, AlertTriangle, CheckCircle2, Clock,
  BarChart3, MapPin, FileText
} from "lucide-react";

type BookingWithInspections = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_date: string;
  return_date: string;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: string;
  notes: string | null;
  driver_age: number | null;
  created_at: string;
  checkin?: any;
  checkout?: any;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600" },
  confirmed: { label: "Confirmada", color: "bg-blue-500/10 text-blue-500" },
  active: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-600" },
  completed: { label: "Concluída", color: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
};

export default function AdminVehicleHistory() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any>(null);
  const [bookings, setBookings] = useState<BookingWithInspections[]>([]);

  useEffect(() => {
    loadData();
  }, [vehicleId]);

  const loadData = async () => {
    if (!vehicleId) return;
    setLoading(true);

    const [vRes, bRes, iRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
      supabase.from("bookings").select("*").eq("vehicle_id", vehicleId).order("pickup_date", { ascending: false }),
      supabase.from("vehicle_inspections").select("*").order("created_at", { ascending: false }),
    ]);

    setVehicle(vRes.data);

    const allInspections = iRes.data || [];
    const enriched = (bRes.data || []).map((b: any) => ({
      ...b,
      checkin: allInspections.find((i: any) => i.booking_id === b.id && i.type === "checkin"),
      checkout: allInspections.find((i: any) => i.booking_id === b.id && i.type === "checkout"),
    }));
    setBookings(enriched);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return <p className="text-muted-foreground">Veículo não encontrado.</p>;
  }

  // Statistics
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
  const avgRevenue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;
  const totalDays = bookings.reduce((sum, b) => {
    const days = Math.ceil(
      (parseDateOnly(b.return_date).getTime() - parseDateOnly(b.pickup_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return sum + Math.max(days, 1);
  }, 0);

  // Mileage tracking from inspections
  const inspectionsWithOdometer = bookings
    .filter((b) => b.checkin?.odometer_reading || b.checkout?.odometer_reading)
    .sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime());

  const firstOdometer = inspectionsWithOdometer[0]?.checkin?.odometer_reading;
  const lastOdometer = inspectionsWithOdometer[inspectionsWithOdometer.length - 1]?.checkout?.odometer_reading
    || inspectionsWithOdometer[inspectionsWithOdometer.length - 1]?.checkin?.odometer_reading;
  const totalKm = firstOdometer && lastOdometer ? lastOdometer - firstOdometer : null;

  const totalDamages = bookings.reduce((sum, b) => {
    return sum + ((b.checkout?.damages as any[])?.length || 0);
  }, 0);

  const uniqueClients = new Set(bookings.map((b) => b.customer_email || b.customer_name)).size;

  const stats = [
    { icon: Calendar, label: "Total Locações", value: bookings.length.toString(), sub: `${completedBookings.length} concluídas` },
    { icon: DollarSign, label: "Receita Total", value: `$${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, sub: `Média $${avgRevenue.toFixed(0)}/locação` },
    { icon: Clock, label: "Dias Alugado", value: totalDays.toString(), sub: `${(totalDays / Math.max(bookings.length, 1)).toFixed(1)} dias/locação` },
    { icon: Gauge, label: "Milhas Percorridas", value: totalKm ? `${totalKm.toLocaleString("pt-BR")} mi` : "", sub: totalKm ? `${(totalKm / Math.max(bookings.length, 1)).toFixed(0)} mi/locação` : "Sem dados" },
    { icon: Users, label: "Clientes Únicos", value: uniqueClients.toString(), sub: `${((bookings.length - uniqueClients) / Math.max(bookings.length, 1) * 100).toFixed(0)}% retorno` },
    { icon: AlertTriangle, label: "Avarias Registradas", value: totalDamages.toString(), sub: totalDamages === 0 ? "Sem avarias" : `${(totalDamages / Math.max(bookings.length, 1)).toFixed(1)}/locação` },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/fleet")} aria-label="Voltar para frota">
          <ChevronLeft size={20} />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          {vehicle.image_url && (
            <img src={vehicle.image_url} alt={vehicle.name} className="w-20 h-14 object-cover rounded-lg border border-border/40" loading="lazy" width={80} height={56} />
          )}
          <div>
            <h1 className="admin-h1 text-2xl">{vehicle.name}</h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.category} • {vehicle.year} • {vehicle.transmission === "Automatic" ? "Automático" : "Manual"} • {vehicle.fuel}
            </p>
          </div>
        </div>
        <Badge className={`${
          vehicle.status === "available" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" :
          vehicle.status === "rented" ? "bg-blue-500/15 text-blue-500 border-blue-500/30" :
          "bg-yellow-500/15 text-yellow-600 border-yellow-500/30"
        }`}>
          {vehicle.status === "available" ? "Disponível" : vehicle.status === "rented" ? "Alugado" : "Manutenção"}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-lg font-medium text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Booking History */}
      <div>
        <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" /> Histórico Completo de Locações
        </h2>

        {bookings.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="p-8 text-center">
              <Car size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma locação registrada para este veículo.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const days = Math.ceil(
                (parseDateOnly(b.return_date).getTime() - parseDateOnly(b.pickup_date).getTime()) / (1000 * 60 * 60 * 24)
              );
              const sc = statusConfig[b.status] || { label: b.status, color: "bg-muted text-muted-foreground" };
              const kmDriven = b.checkin?.odometer_reading && b.checkout?.odometer_reading
                ? b.checkout.odometer_reading - b.checkin.odometer_reading : null;
              const checkoutDamages = (b.checkout?.damages as any[])?.length || 0;
              const hasInspections = b.checkin || b.checkout;

              return (
                <Card key={b.id} className="border-border/40 hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Main info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{formatPersonName(b.customer_name)}</span>
                          <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR")} → {parseDateOnly(b.return_date).toLocaleDateString("pt-BR")}
                          </span>
                          <span>{days} dia(s)</span>
                          {b.customer_email && <span>{b.customer_email}</span>}
                        </div>
                        {(b.pickup_location || b.return_location) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={11} />
                            {b.pickup_location || ""} → {b.return_location || b.pickup_location || ""}
                          </div>
                        )}
                      </div>

                      {/* Financial */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Valor</p>
                          <p className="font-medium text-foreground">
                            ${b.total_price?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || ""}
                          </p>
                        </div>
                        {kmDriven !== null && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground">Milhas</p>
                            <p className="font-medium text-foreground">{kmDriven.toLocaleString("pt-BR")}</p>
                          </div>
                        )}
                        {b.checkin?.fuel_level && b.checkout?.fuel_level && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground">Combustível</p>
                            <p className="font-medium text-foreground text-xs">
                              {b.checkin.fuel_level} → {b.checkout.fuel_level}
                            </p>
                          </div>
                        )}
                        {checkoutDamages > 0 && (
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground">Avarias</p>
                            <p className="font-medium text-destructive">{checkoutDamages}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5">
                        {hasInspections && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/inspection/compare/${b.id}`)}
                            className="text-xs h-8"
                          >
                            <FileText size={12} className="mr-1" /> Inspeções
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inspection summary row */}
                    {hasInspections && (
                      <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {b.checkin?.completed_at ? (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          ) : (
                            <Clock size={12} className="text-yellow-500" />
                          )}
                          Entrega: {b.checkin?.completed_at ? "Finalizada" : b.checkin ? "Rascunho" : "Pendente"}
                        </span>
                        <span className="flex items-center gap-1">
                          {b.checkout?.completed_at ? (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          ) : (
                            <Clock size={12} className="text-yellow-500" />
                          )}
                          Devolução: {b.checkout?.completed_at ? "Finalizada" : b.checkout ? "Rascunho" : "Pendente"}
                        </span>
                        {b.checkin?.odometer_reading && (
                          <span>Odômetro entrada: {b.checkin.odometer_reading.toLocaleString("pt-BR")} mi</span>
                        )}
                        {b.checkout?.odometer_reading && (
                          <span>Odômetro saída: {b.checkout.odometer_reading.toLocaleString("pt-BR")} mi</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
