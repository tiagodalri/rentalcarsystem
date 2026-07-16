import { formatPersonName } from "@/lib/formatName";
import { parseDateOnly } from "@/lib/dateOnly";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, User, Mail, Phone, FileText, MapPin,
  DollarSign, Calendar, AlertTriangle, Car, TrendingUp,
  Globe, CreditCard, Pencil, Star, ShieldAlert, AlertCircle, MessageCircle,
} from "lucide-react";
import { CustomerDetailSkeleton } from "@/components/skeletons/DetailSkeletons";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { CustomerTagsManager } from "@/components/admin/CustomerTagsManager";
import { CustomerNotesTimeline } from "@/components/admin/CustomerNotesTimeline";
import { buildWhatsAppUrl, defaultClientMessage } from "@/lib/whatsapp";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  nationality: string | null;
  driver_license: string | null;
  driver_license_expiry: string | null;
  notes: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  customer_name: string;
  pickup_date: string;
  return_date: string;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: string;
  notes: string | null;
  vehicle_id: string | null;
};

type VehicleMap = Record<string, { name: string; category: string }>;

type InspectionRow = {
  id: string;
  booking_id: string;
  type: string;
  damages: any;
  odometer_reading: number | null;
  fuel_level: string | null;
  completed_at: string | null;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  confirmed: { label: "Confirmada", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  active: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  in_progress: { label: "Em andamento", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  completed: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  cancelled: { label: "Cancelada", color: "bg-red-500/10 text-red-500 border-red-500/30" },
};

export default function AdminCustomerDetail() {
  const { hasAny } = useAdminAuth();
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleMap>({});
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [favoriteCategory, setFavoriteCategory] = useState<string | null>(null);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    const load = async () => {
      setLoading(true);

      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
      if (!c) { setLoading(false); return; }
      setCustomer(c);

      const { data: bks } = await supabase.from("bookings").select("*").eq("customer_id", customerId).order("pickup_date", { ascending: false });
      const bookingList = bks || [];
      setBookings(bookingList);

      // Load vehicles for these bookings
      const vehicleIds = [...new Set(bookingList.map(b => b.vehicle_id).filter(Boolean))] as string[];
      if (vehicleIds.length > 0) {
        const { data: vehs } = await supabase.from("vehicles").select("id, name, category").in("id", vehicleIds);
        const map: VehicleMap = {};
        (vehs || []).forEach(v => { map[v.id] = { name: v.name, category: v.category }; });
        setVehicles(map);
      }

      // Load inspections for these bookings
      const bookingIds = bookingList.map(b => b.id);
      if (bookingIds.length > 0) {
        const { data: insp } = await supabase.from("vehicle_inspections").select("*").in("booking_id", bookingIds);
        setInspections(insp || []);
      }

      // Favorite category
      const vehIds = bookingList.map(b => b.vehicle_id).filter(Boolean) as string[];
      if (vehIds.length > 0) {
        const catCount: Record<string, number> = {};
        const vMap = vehicles || {};
        // Use already-loaded vehicles map built above
        bookingList.forEach(b => {
          if (b.vehicle_id) {
            // vMap may not be set yet, use vehs from above
          }
        });
        // Re-query vehicles for categories
        const { data: allVehs } = await supabase.from("vehicles").select("id, category").in("id", vehIds);
        const catMap: Record<string, string> = {};
        (allVehs || []).forEach(v => { catMap[v.id] = v.category; });
        bookingList.forEach(b => {
          if (b.vehicle_id && catMap[b.vehicle_id]) {
            const cat = catMap[b.vehicle_id];
            catCount[cat] = (catCount[cat] || 0) + 1;
          }
        });
        const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) setFavoriteCategory(sorted[0][0]);
      }

      // Incident count from vehicle_incidents via bookings
      const bIds = bookingList.map(b => b.id);
      if (bIds.length > 0) {
        const { count } = await supabase
          .from("vehicle_incidents")
          .select("id", { count: "exact", head: true })
          .in("booking_id", bIds);
        setIncidentCount(count || 0);
      }

      setLoading(false);
    };
    load();
  }, [customerId]);

  if (loading) return <CustomerDetailSkeleton />;
  if (!customer) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-muted-foreground">Cliente não encontrado.</p>
      <button onClick={() => navigate("/admin/customers")} className="text-sm text-primary hover:underline">Voltar</button>
    </div>
  );

  // Computed stats
  const totalRevenue = bookings.filter(b => b.status === "completed").reduce((sum, b) => sum + (b.total_price || 0), 0);
  const completedBookings = bookings.filter(b => b.status === "completed").length;
  const activeBookings = bookings.filter(b => ["active", "in_progress", "confirmed"].includes(b.status)).length;
  const cancelledBookings = bookings.filter(b => b.status === "cancelled").length;

  // Damages across all inspections
  const allDamages: { booking_id: string; type: string; damage: any }[] = [];
  inspections.forEach(insp => {
    if (Array.isArray(insp.damages)) {
      insp.damages.forEach((d: any) => {
        allDamages.push({ booking_id: insp.booking_id, type: insp.type, damage: d });
      });
    }
  });

  // New damages (checkout damages not in checkin)
  const newDamagesByBooking: Record<string, any[]> = {};
  const bookingIds = bookings.map(b => b.id);
  bookingIds.forEach(bid => {
    const checkinDamages = inspections.find(i => i.booking_id === bid && i.type === "checkin")?.damages;
    const checkoutDamages = inspections.find(i => i.booking_id === bid && i.type === "checkout")?.damages;
    const ciCount = Array.isArray(checkinDamages) ? checkinDamages.length : 0;
    const coList = Array.isArray(checkoutDamages) ? checkoutDamages : [];
    if (coList.length > ciCount) {
      newDamagesByBooking[bid] = coList.slice(ciCount);
    }
  });
  const totalNewDamages = Object.values(newDamagesByBooking).reduce((sum, arr) => sum + arr.length, 0);

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-4">{children}</h2>
  );

  const DetailItem = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || ""}</span>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, color = "text-foreground" }: { icon: any; label: string; value: string | number; color?: string }) => (
    <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/30 bg-card/80 gap-1.5 min-h-[88px]">
      <Icon size={16} className="text-primary/60" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center leading-tight">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate("/admin/customers")} className="hover:text-foreground transition-colors">Clientes</button>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium">{formatPersonName(customer.full_name)}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <PersonAvatar name={customer.full_name} size="lg" tone="gold" />
            <h1 className="admin-h1 text-2xl">{formatPersonName(customer.full_name)}</h1>
            {(customer as any).source === "turo" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-purple-500/15 text-purple-500 border border-purple-500/30">
                <Car size={11} /> Turo
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(customer as any).source === "turo" ? (
              <>
                {(customer as any).turo_guest_id && (
                  <span className="flex items-center gap-1 font-mono tabular-nums">Guest # {(customer as any).turo_guest_id}</span>
                )}
                <span className="italic">Hóspede importado da Turo. sem dados de contato</span>
              </>
            ) : (
              <>
                {customer.email && <span className="flex items-center gap-1"><Mail size={11} /> {customer.email}</span>}
                {customer.phone && <span className="flex items-center gap-1"><Phone size={11} /> {customer.phone}</span>}
              </>
            )}
            <span className="text-border">|</span>
            <span>Cliente desde {new Date(customer.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="pt-1">
            <CustomerTagsManager customerId={customer.id} />
          </div>
        </div>
        {(() => {
          const wa = buildWhatsAppUrl(customer.phone, defaultClientMessage(customer.full_name));
          if (!wa) return null;
          return (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-medium uppercase tracking-wider hover:bg-emerald-500/25 transition-colors shrink-0"
            >
              <MessageCircle size={14} /> Enviar WhatsApp
            </a>
          );
        })()}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={FileText} label="Total Reservas" value={bookings.length} />
        <MetricCard icon={Calendar} label="Concluídas" value={completedBookings} color="text-emerald-500" />
        <MetricCard icon={TrendingUp} label="Ativas" value={activeBookings} color="text-blue-500" />
        <MetricCard icon={DollarSign} label="Receita Total" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} color="text-primary" />
        <MetricCard icon={AlertTriangle} label="Avarias Causadas" value={totalNewDamages} color={totalNewDamages > 0 ? "text-red-500" : "text-emerald-500"} />
        <MetricCard icon={CreditCard} label="Canceladas" value={cancelledBookings} color={cancelledBookings > 0 ? "text-red-400" : "text-muted-foreground"} />
      </div>

      {/* Customer metrics section. visible to admin, support, operations */}
      {hasAny(["admin", "support", "operations"]) && (
        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Metricas do Cliente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <MetricCard
              icon={Star}
              label="Categoria Favorita"
              value={favoriteCategory || ""}
              color="text-primary"
            />
            <MetricCard
              icon={ShieldAlert}
              label="Historico de Avarias"
              value={incidentCount}
              color={incidentCount > 0 ? "text-red-500" : "text-emerald-500"}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left - Customer info */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card/80 border-border/30">
            <CardContent className="p-5">
              <SectionTitle>Dados Cadastrais</SectionTitle>
              <DetailItem label="Nome completo" value={formatPersonName(customer.full_name)} />
              <DetailItem label="E-mail" value={customer.email} />
              <DetailItem label="Telefone" value={customer.phone} />
              <DetailItem label="Data de Nascimento" value={(customer as any).date_of_birth ? new Date((customer as any).date_of_birth).toLocaleDateString("pt-BR") : null} />
              <DetailItem label="Documento (CPF/Passport/ID)" value={customer.document_number} />
              <DetailItem label="CNH" value={customer.driver_license} />
              {/* CNH Expiry Badge */}
              {(() => {
                const expiry = customer.driver_license_expiry;
                if (!expiry) return null;
                const expiryDate = new Date(expiry + "T00:00:00");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                  return (
                    <div className="flex items-center gap-1.5 py-1.5">
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-[10px] gap-1">
                        <AlertCircle size={10} /> CNH VENCIDA
                      </Badge>
                    </div>
                  );
                }
                if (diffDays <= 30) {
                  return (
                    <div className="flex items-center gap-1.5 py-1.5">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px] gap-1">
                        <AlertCircle size={10} /> CNH vence em {diffDays} dias
                      </Badge>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center gap-1.5 py-1.5">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                      CNH valida ate {expiryDate.toLocaleDateString("pt-BR")}
                    </Badge>
                  </div>
                );
              })()}
              <DetailItem label="Nacionalidade" value={customer.nationality} />
              <DetailItem label="Endereço" value={(customer as any).address} />
              <DetailItem label="CEP / Zip" value={(customer as any).zip_code} />
              <DetailItem label="Cadastro" value={new Date(customer.created_at).toLocaleDateString("pt-BR")} />
              {(customer as any).driver_license_file_url && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">CNH Anexada</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const { getCnhViewUrl } = await import("@/lib/cnhStorage");
                      const url = await getCnhViewUrl((customer as any).driver_license_file_url);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver documento →
                  </button>
                </div>
              )}
              {customer.notes && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Observações</p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">{customer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Damages summary */}
          {totalNewDamages > 0 && (
            <Card className="bg-card/80 border-border/30">
              <CardContent className="p-5">
                <SectionTitle>Avarias Registradas</SectionTitle>
                <div className="space-y-3">
                  {Object.entries(newDamagesByBooking).map(([bid, damages]) => {
                    const bk = bookings.find(b => b.id === bid);
                    const veh = bk?.vehicle_id ? vehicles[bk.vehicle_id] : null;
                    return (
                      <div key={bid} className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{veh?.name || "Veículo"}</span>
                          <span className="text-[10px] text-muted-foreground">{bk ? parseDateOnly(bk.pickup_date).toLocaleDateString("pt-BR") : ""}</span>
                        </div>
                        {damages.map((d: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs pl-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${d.severity === "heavy" ? "bg-red-500" : d.severity === "medium" ? "bg-amber-500" : "bg-yellow-400"}`} />
                            <div>
                              <span className="text-foreground">{d.description}</span>
                              {d.position && <span className="text-muted-foreground/50 ml-1.5">({d.position})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right - Booking history */}
        <div className="lg:col-span-8">
          <Card className="bg-card/80 border-border/30 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/20 bg-muted/20">
              <h2 className="text-sm font-semibold text-foreground">Histórico de Reservas</h2>
            </div>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <p className="p-8 text-sm text-muted-foreground text-center">Nenhuma reserva encontrada.</p>
              ) : (
                <div className="divide-y divide-border/10">
                  {bookings.map((b) => {
                    const sc = statusConfig[b.status] || statusConfig.pending;
                    const veh = b.vehicle_id ? vehicles[b.vehicle_id] : null;
                    const pickup = parseDateOnly(b.pickup_date);
                    const returnD = parseDateOnly(b.return_date);
                    const days = Math.max(1, Math.ceil((returnD.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
                    const checkin = inspections.find(i => i.booking_id === b.id && i.type === "checkin");
                    const checkout = inspections.find(i => i.booking_id === b.id && i.type === "checkout");
                    const bkNewDamages = newDamagesByBooking[b.id] || [];

                    return (
                      <div
                        key={b.id}
                        onClick={() => navigate(`/admin/bookings/${b.id}`)}
                        className="px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        {/* Row 1: Vehicle + status + price */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                              <Car size={14} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-foreground">{veh?.name || "Veículo não vinculado"}</p>
                              <p className="text-[10px] text-muted-foreground">{veh?.category || ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`${sc.color} border text-[10px] px-2 py-0.5 font-semibold`}>{sc.label}</Badge>
                            <span className="text-sm font-medium text-foreground tabular-nums">
                              {b.total_price ? `$${b.total_price.toFixed(2)}` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Details */}
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground ml-11">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {pickup.toLocaleDateString("pt-BR")} → {returnD.toLocaleDateString("pt-BR")} ({days}d)
                          </span>
                          {b.pickup_location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {b.pickup_location}
                            </span>
                          )}
                        </div>

                        {/* Row 3: Inspection summary (if any) */}
                        {(checkin || checkout || bkNewDamages.length > 0) && (
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground ml-11 mt-2">
                            {checkin && (
                              <span>Entrega: {checkin.odometer_reading?.toLocaleString() || ""} mi · {checkin.fuel_level || ""}</span>
                            )}
                            {checkout && (
                              <span>Devolução: {checkout.odometer_reading?.toLocaleString() || ""} mi · {checkout.fuel_level || ""}</span>
                            )}
                            {checkin && checkout && checkin.odometer_reading && checkout.odometer_reading && (
                              <span className="font-medium text-foreground">
                                {(checkout.odometer_reading - checkin.odometer_reading).toLocaleString()} mi rodadas
                              </span>
                            )}
                            {bkNewDamages.length > 0 && (
                              <span className="text-red-500 font-semibold flex items-center gap-1">
                                <AlertTriangle size={10} /> {bkNewDamages.length} avaria{bkNewDamages.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notes timeline */}
      <Card className="bg-card/80 border-border/30">
        <CardContent className="p-5">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-4">Anotações Internas</h2>
          <CustomerNotesTimeline customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  );
}
