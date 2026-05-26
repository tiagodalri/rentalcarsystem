import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User, FileText, LogIn, LogOut, GitCompare,
  Fuel, Gauge, CheckCircle2, AlertTriangle, ChevronRight,
  Camera, PenTool, Image, Check, X as XIcon, Pencil, Send, Loader2
} from "lucide-react";
import { BookingDetailSkeleton } from "@/components/skeletons/DetailSkeletons";
import { LocationDisplay } from "@/components/admin/LocationDisplay";
import { EditBookingDialog } from "@/components/admin/EditBookingDialog";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Booking = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  pickup_date: string;
  return_date: string;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: string;
  notes: string | null;
  driver_age: number | null;
  extra_driver: boolean | null;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  contract_status?: string | null;
  contract_error?: string | null;
  clicksign_envelope_id?: string | null;
  booking_number?: string | null;
};

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  nationality: string | null;
  driver_license: string | null;
  notes: string | null;
};

type Vehicle = {
  id: string;
  name: string;
  category: string;
  daily_price_usd: number;
  passengers: number;
  bags: number;
  transmission: string;
  fuel: string;
  year: number | null;
  image_url: string | null;
  status: string;
};

type Inspection = {
  id: string;
  type: string;
  odometer_reading: number | null;
  fuel_level: string | null;
  damages: any;
  accessories_check: any;
  exterior_photos: any;
  customer_signature: string | null;
  agent_signature: string | null;
  notes: string | null;
  agent_name: string | null;
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

const contractStatusConfig: Record<string, { label: string; cls: string }> = {
  not_sent: { label: "Contrato: não enviado", cls: "bg-muted text-muted-foreground border-border" },
  generating: { label: "Contrato: gerando", cls: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  sent: { label: "Contrato: enviado", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  partially_signed: { label: "Contrato: parcial", cls: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  signed: { label: "Contrato: assinado", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  cancelled: { label: "Contrato: cancelado", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
  failed: { label: "Contrato: falhou", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
};

export default function AdminBookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { isAdmin, hasAny } = useAdminAuth();
  const [sendingContract, setSendingContract] = useState(false);

  const canSendContract = hasAny(["admin", "operations"]);

  const handleSendContract = async () => {
    if (!booking) return;
    setSendingContract(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contract", {
        body: { booking_id: booking.id },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message;
        try {
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) msg = body.error;
          if (body?.missing_fields) msg += ` (faltando: ${body.missing_fields.join(", ")})`;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      toast.success("Contrato enviado para assinatura.");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar contrato.");
      await reload();
    } finally {
      setSendingContract(false);
    }
  };

  const reload = async () => {
    if (!bookingId) return;
    const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (b) setBooking(b);
  };

  useEffect(() => {
    if (!bookingId) return;
    const load = async () => {
      setLoading(true);
      const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
      if (!b) { setLoading(false); return; }
      setBooking(b);

      if (b.customer_id) {
        const { data: c } = await supabase.from("customers").select("*").eq("id", b.customer_id).single();
        setCustomer(c);
      }
      if (b.vehicle_id) {
        const { data: v } = await supabase.from("vehicles").select("*").eq("id", b.vehicle_id).single();
        setVehicle(v);
      }
      const { data: insp } = await supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId);
      setInspections(insp || []);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  if (loading) return <BookingDetailSkeleton />;
  if (!booking) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-muted-foreground">Reserva não encontrada.</p>
      <button onClick={() => navigate("/admin/bookings")} className="text-sm text-primary hover:underline">Voltar</button>
    </div>
  );

  const checkin = inspections.find(i => i.type === "checkin");
  const checkout = inspections.find(i => i.type === "checkout");
  const pickup = new Date(booking.pickup_date);
  const returnD = new Date(booking.return_date);
  const days = Math.max(1, Math.ceil((returnD.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
  const sc = statusConfig[booking.status] || statusConfig.pending;

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-4">{children}</h2>
  );

  const DetailItem = ({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{value || "—"}</span>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, color = "text-foreground" }: { icon: any; label: string; value: string | number; color?: string }) => (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/30 bg-card/80 gap-1 min-h-[80px]">
      <Icon size={14} className="text-primary/60" />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider text-center leading-tight">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );

  const FullInspectionSection = ({ insp, label, type }: { insp: Inspection | undefined; label: string; type: "checkin" | "checkout" }) => {
    if (!insp) {
      return (
        <Card className="bg-card/80 border-border/30 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-2">
              {type === "checkin" ? <LogIn size={14} className="text-primary" /> : <LogOut size={14} className="text-primary" />}
              <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            </div>
            <span className="text-[10px] text-muted-foreground/50 italic">Não realizada</span>
          </div>
          <CardContent className="p-5 flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
              <FileText size={18} className="text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">Inspeção pendente</p>
            <button
              onClick={() => navigate(`/admin/inspection/${booking.id}?type=${type}`)}
              className="text-xs text-primary hover:underline font-medium mt-1"
            >
              Realizar inspeção →
            </button>
          </CardContent>
        </Card>
      );
    }

    const damages = Array.isArray(insp.damages) ? insp.damages : [];
    const accessories = insp.accessories_check && typeof insp.accessories_check === "object" ? insp.accessories_check as Record<string, boolean> : {};
    const accessoryEntries = Object.entries(accessories);
    const accessoryOk = accessoryEntries.filter(([, v]) => v).length;
    const photos = Array.isArray(insp.exterior_photos) ? insp.exterior_photos as { id: string; position: string; url: string }[] : [];

    return (
      <Card className="bg-card/80 border-border/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-muted/20">
          <div className="flex items-center gap-2">
            {type === "checkin" ? <LogIn size={14} className="text-primary" /> : <LogOut size={14} className="text-primary" />}
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          </div>
          <div className="flex items-center gap-3">
            {insp.agent_name && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User size={10} /> {insp.agent_name}
              </span>
            )}
            {insp.completed_at && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {new Date(insp.completed_at).toLocaleDateString("pt-BR")} · {new Date(insp.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard icon={Gauge} label="Odômetro" value={insp.odometer_reading ? `${insp.odometer_reading.toLocaleString()} km` : "—"} />
            <MetricCard icon={Fuel} label="Combustível" value={insp.fuel_level || "—"} />
            <MetricCard icon={AlertTriangle} label="Avarias" value={damages.length} color={damages.length > 0 ? "text-red-500" : "text-emerald-500"} />
            <MetricCard icon={CheckCircle2} label="Acessórios" value={`${accessoryOk}/${accessoryEntries.length}`} />
          </div>

          {/* Exterior photos */}
          {photos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera size={12} className="text-primary/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fotos Exteriores ({photos.length})</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setExpandedPhoto(photo.url)}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-border/30 hover:border-primary/40 transition-all"
                  >
                    <img src={photo.url} alt={photo.position} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Image size={16} className="text-foreground" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm px-1.5 py-0.5">
                      <span className="text-[8px] text-foreground font-medium">{photo.position}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Damages */}
          {damages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={12} className="text-red-500/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avarias ({damages.length})</span>
              </div>
              <div className="space-y-2">
                {damages.map((d: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/20 border border-border/20 p-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${d.severity === "heavy" ? "bg-red-500" : d.severity === "medium" ? "bg-amber-500" : "bg-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{d.description}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${
                          d.severity === "heavy" ? "border-red-500/30 text-red-500" :
                          d.severity === "medium" ? "border-amber-500/30 text-amber-600" :
                          "border-yellow-500/30 text-yellow-600"
                        }`}>
                          {d.severity === "heavy" ? "Grave" : d.severity === "medium" ? "Média" : "Leve"}
                        </Badge>
                      </div>
                      {d.position && <span className="text-[10px] text-muted-foreground">{d.position}</span>}
                    </div>
                    {d.photoUrl && (
                      <button onClick={() => setExpandedPhoto(d.photoUrl)} className="w-10 h-10 rounded-md overflow-hidden border border-border/30 shrink-0">
                        <img src={d.photoUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accessories */}
          {accessoryEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={12} className="text-primary/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Acessórios</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {accessoryEntries.map(([key, val]) => (
                  <div key={key} className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs border ${
                    val ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" : "border-red-500/20 bg-red-500/5 text-red-500"
                  }`}>
                    {val ? <Check size={11} /> : <XIcon size={11} />}
                    <span className="truncate">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          {(insp.customer_signature || insp.agent_signature) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PenTool size={12} className="text-primary/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Assinaturas</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {insp.customer_signature && (
                  <div className="rounded-lg border border-border/30 bg-white p-2">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Cliente</p>
                    <img src={insp.customer_signature} alt="Assinatura do cliente" className="w-full h-16 object-contain" />
                  </div>
                )}
                {insp.agent_signature && (
                  <div className="rounded-lg border border-border/30 bg-white p-2">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Agente</p>
                    <img src={insp.agent_signature} alt="Assinatura do agente" className="w-full h-16 object-contain" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {insp.notes && (
            <div className="rounded-lg bg-muted/30 border border-border/20 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Observações</p>
              <p className="text-xs text-muted-foreground italic leading-relaxed">{insp.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Photo lightbox */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80">
            <XIcon size={20} />
          </button>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate("/admin/bookings")} className="hover:text-foreground transition-colors">Reservas</button>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium">{booking.customer_name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{booking.customer_name}</h1>
            <Badge className={`${sc.color} border text-[10px] px-2.5 py-0.5 font-semibold`}>{sc.label}</Badge>
            {(() => {
              const cs = contractStatusConfig[booking.contract_status || "not_sent"] || contractStatusConfig.not_sent;
              const badge = (
                <Badge className={`${cs.cls} border text-[10px] px-2.5 py-0.5 font-semibold`}>{cs.label}</Badge>
              );
              if (booking.contract_status === "failed" && booking.contract_error) {
                return (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
                      <TooltipContent className="max-w-sm text-xs">{booking.contract_error}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return badge;
            })()}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{pickup.toLocaleDateString("pt-BR")} → {returnD.toLocaleDateString("pt-BR")}</span>
            <span className="text-border">|</span>
            <span>{days} dia{days > 1 ? "s" : ""}</span>
            <span className="text-border">|</span>
            <span className="font-semibold text-foreground">{booking.total_price ? `$${booking.total_price.toFixed(2)}` : "—"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/inspection/${booking.id}?type=checkin`)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium border border-primary/20"
          >
            <LogIn size={13} /> Entrega
          </button>
          <button
            onClick={() => navigate(`/admin/inspection/${booking.id}?type=checkout`)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors font-medium border border-border/40"
          >
            <LogOut size={13} /> Devolução
          </button>
          <button
            onClick={() => navigate(`/admin/inspection/compare/${booking.id}`)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium border border-border/40"
          >
            <GitCompare size={13} /> Comparar
          </button>
          {canSendContract && ["not_sent", "failed"].includes(booking.contract_status || "not_sent") && (
            <button
              onClick={handleSendContract}
              disabled={sendingContract}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
            >
              {sendingContract ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {sendingContract ? "Enviando..." : "Enviar Contrato"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
              title="Editar reserva (apenas admin)"
            >
              <Pencil size={13} /> Editar
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <EditBookingDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          booking={booking}
          onSaved={reload}
        />
      )}

      {/* Info cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Booking info */}
        <div className="lg:col-span-4">
          <Card className="bg-card/80 border-border/30">
            <CardContent className="p-5">
              <SectionTitle>Reserva</SectionTitle>

              <div className="space-y-2.5 mb-3">
                <LocationDisplay
                  label="Retirada"
                  date={pickup.toLocaleDateString("pt-BR")}
                  address={booking.pickup_location}
                />
                <LocationDisplay
                  label="Devolução"
                  date={returnD.toLocaleDateString("pt-BR")}
                  address={booking.return_location}
                />
              </div>

              <DetailItem label="Duração" value={`${days} dia${days > 1 ? "s" : ""}`} />
              <DetailItem label="Valor Total" value={booking.total_price ? `$${booking.total_price.toFixed(2)}` : "—"} highlight />
              <DetailItem label="Condutor Adicional" value={booking.extra_driver ? "Sim" : "Não"} />
              <DetailItem label="Idade do Condutor" value={booking.driver_age ? `${booking.driver_age} anos` : "—"} />
              <DetailItem label="Criada em" value={new Date(booking.created_at).toLocaleDateString("pt-BR")} />
              {booking.notes && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Observações</p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer */}
        <div className="lg:col-span-4">
          <Card className="bg-card/80 border-border/30">
            <CardContent className="p-5">
              <SectionTitle>Cliente</SectionTitle>
              {customer ? (
                <>
                  <DetailItem label="Nome" value={customer.full_name} />
                  <DetailItem label="E-mail" value={customer.email} />
                  <DetailItem label="Telefone" value={customer.phone} />
                  <DetailItem label="CPF" value={customer.document_number} />
                  <DetailItem label="CNH" value={customer.driver_license} />
                  <DetailItem label="Nacionalidade" value={customer.nationality} />
                  {customer.notes && (
                    <div className="mt-3 pt-3 border-t border-border/20">
                      <p className="text-xs text-muted-foreground italic leading-relaxed">{customer.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">Cliente não vinculado</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vehicle */}
        <div className="lg:col-span-4">
          <Card className="bg-card/80 border-border/30">
            <CardContent className="p-5">
              <SectionTitle>Veículo</SectionTitle>
              {vehicle ? (
                <>
                  <DetailItem label="Modelo" value={`${vehicle.name}${vehicle.year ? ` (${vehicle.year})` : ""}`} />
                  <DetailItem label="Categoria" value={vehicle.category} />
                  <DetailItem label="Diária" value={`$${vehicle.daily_price_usd.toFixed(2)}`} highlight />
                  <DetailItem label="Passageiros" value={vehicle.passengers} />
                  <DetailItem label="Malas" value={vehicle.bags} />
                  <DetailItem label="Transmissão" value={vehicle.transmission} />
                  <DetailItem label="Combustível" value={vehicle.fuel} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">Veículo não vinculado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Inspection sections */}
      <FullInspectionSection insp={checkin} label="Checkin (Entrega)" type="checkin" />
      <FullInspectionSection insp={checkout} label="Checkout (Devolução)" type="checkout" />

      {/* Comparison bar */}
      {checkin && checkout && (
        <Card className="bg-card/80 border-border/30">
          <CardContent className="p-5">
            <SectionTitle>Comparativo Entrega × Devolução</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard
                icon={Gauge}
                label="KM Rodados"
                value={checkin.odometer_reading && checkout.odometer_reading
                  ? `${(checkout.odometer_reading - checkin.odometer_reading).toLocaleString()} km`
                  : "—"}
              />
              <MetricCard icon={Fuel} label="Combustível Entrega" value={checkin.fuel_level || "—"} />
              <MetricCard icon={Fuel} label="Combustível Devolução" value={checkout.fuel_level || "—"} />
              <MetricCard
                icon={AlertTriangle}
                label="Novas Avarias"
                value={Math.max(0, (Array.isArray(checkout.damages) ? checkout.damages.length : 0) - (Array.isArray(checkin.damages) ? checkin.damages.length : 0))}
                color={
                  (Array.isArray(checkout.damages) ? checkout.damages.length : 0) > (Array.isArray(checkin.damages) ? checkin.damages.length : 0)
                    ? "text-red-500" : "text-emerald-500"
                }
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
