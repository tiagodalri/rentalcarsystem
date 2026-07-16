import { formatPersonName } from "@/lib/formatName";
import { normalizeDamageText } from "@/lib/damageTextNormalizer";
import { parseDateOnly } from "@/lib/dateOnly";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User, FileText, LogIn, LogOut, GitCompare,
  Fuel, Gauge, CheckCircle2, AlertTriangle, ChevronRight,
  Camera, PenTool, Image, Check, X as XIcon, Pencil, Send, Loader2, MessageCircle, ArrowRight
} from "lucide-react";
import { BookingDetailSkeleton } from "@/components/skeletons/DetailSkeletons";
import { LocationDisplay } from "@/components/admin/LocationDisplay";
import MiniLocationMap from "@/components/admin/MiniLocationMap";
import { useHideFinancials } from "@/hooks/useHideFinancials";
import { EditBookingDialog } from "@/components/admin/EditBookingDialog";
import { BookingIncidentDialog } from "@/components/admin/BookingIncidentDialog";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SignedImage } from "@/components/admin/SignedImage";
import { ShareWhatsAppInspectionButton } from "@/components/admin/ShareWhatsAppInspectionButton";
import { ShareInspectionButton } from "@/components/admin/ShareInspectionButton";
import { BookingEpassTolls } from "@/components/admin/booking/BookingEpassTolls";
import { PhotoLightbox } from "@/components/admin/PhotoLightbox";

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};
const POSITION_LABELS: Record<string, string> = {
  front: "Frente", rear: "Traseira", left: "Lateral Esquerda", right: "Lateral Direita",
  hood: "Capô", roof: "Teto", trunk: "Porta-malas",
  front_left: "Dianteira Esquerda", front_right: "Dianteira Direita",
  rear_left: "Traseira Esquerda", rear_right: "Traseira Direita",
  dashboard: "Painel", odometer: "Odômetro", fuel: "Combustível",
  interior: "Interior", keys_ticket: "Chaves + Ticket",
};
const positionLabel = (p?: string) => {
  if (!p) return "";
  const clean = p.replace(/^__/, "");
  return POSITION_LABELS[clean] || clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const ACCESSORIES_LABELS: Record<string, string> = {
  jack: "Macaco", antenna: "Antena", first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe", triangle: "Triângulo", floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};
const accessoryLabel = (k: string) =>
  ACCESSORIES_LABELS[k] ||
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
  turo_reservation_code?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  deposit_amount?: number | null;
  franchise_amount?: number | null;
  
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
  e_pass_transponder?: string | null;
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
  not_sent: { label: "Contrato: opcional", cls: "bg-muted text-muted-foreground border-border" },
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
  const hideFin = useHideFinancials();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ items: { url: string; label?: string }[]; index: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const { isAdmin, hasAny } = useAdminAuth();
  const [sendingContract, setSendingContract] = useState(false);

  const canSendContract = hasAny(["admin", "operations"]);

  const missingContractFields = (() => {
    if (!customer) return [] as string[];
    const m: string[] = [];
    if (!customer.full_name || !String(customer.full_name).trim()) m.push("Nome completo");
    if (!customer.email || !String(customer.email).trim()) m.push("E-mail");
    if (!customer.driver_license || !String(customer.driver_license).trim()) m.push("Número da CNH");
    if (!customer.document_number || !String(customer.document_number).trim()) m.push("Documento (CPF/Passport/ID)");
    return m;
  })();
  const canActuallySendContract = missingContractFields.length === 0;

  const handleSendContract = async () => {
    if (!booking) return;
    if (!canActuallySendContract) {
      toast.error(
        `Não é possível enviar: cliente sem ${missingContractFields.join(", ")}. Preencha no cadastro antes.`,
        { duration: 6000 },
      );
      return;
    }
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
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      toast.success("Contrato enviado para assinatura.");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar contrato.", { duration: 6000 });
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
      // Single round-trip: booking + related customer/vehicle/inspections.
      const { data: b } = await supabase
        .from("bookings")
        .select(
          "*, customer:customers(*), vehicle:vehicles(*), inspections:vehicle_inspections(*)",
        )
        .eq("id", bookingId)
        .single();
      if (!b) { setLoading(false); return; }
      const { customer: c, vehicle: v, inspections: insp, ...bookingRow } = b as any;
      setBooking(bookingRow);
      setCustomer(c ?? null);
      setVehicle(v ?? null);
      setInspections(insp ?? []);
      setLoading(false);
      // Pre-warm signed URLs for all inspection photos in one batched call.
      try {
        const urls: string[] = [];
        for (const i of insp ?? []) {
          const ext = Array.isArray(i.exterior_photos) ? i.exterior_photos : [];
          for (const p of ext) if (p?.url) urls.push(p.url);
          const dmg = Array.isArray(i.damages) ? i.damages : [];
          for (const d of dmg) if (d?.photoUrl) urls.push(d.photoUrl);
        }
        if (urls.length) {
          const { prefetchSignedInspectionUrls } = await import("@/lib/inspectionStorage");
          prefetchSignedInspectionUrls(urls);
        }
      } catch { /* non-fatal */ }
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
  const pickup = parseDateOnly(booking.pickup_date);
  const returnD = parseDateOnly(booking.return_date);
  const days = Math.max(1, Math.ceil((returnD.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
  const sc = statusConfig[booking.status] || statusConfig.pending;

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-4">{children}</h2>
  );

  const DetailItem = ({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>{value || "—"}</span>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, color = "text-foreground" }: { icon: any; label: string; value: string | number; color?: string }) => (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/30 bg-card/80 gap-1 min-h-[80px]">
      <Icon size={14} className="text-primary/60" />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center leading-tight">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );

  const FullInspectionSection = ({ insp, label, type }: { insp: Inspection | undefined; label: string; type: "checkin" | "checkout" }) => {
    if (!insp) {
      return (
        <Card className="bg-card/80 border-border/30 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-2">
              {type === "checkin" ? <LogIn size={14} className="text-primary" /> : <LogOut size={14} className="text-primary" />}
              <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            </div>
            <span className="text-[10px] text-muted-foreground/50 italic">Não realizada</span>
          </div>
          <CardContent className="px-5 flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted/50 flex items-center justify-center">
              <FileText size={18} className="text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">Inspeção pendente</p>
            <button
              onClick={() => navigate(`/admin/inspection/${booking.id}?type=${type}`)}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              Realizar inspeção <ArrowRight size={12} />
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
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/20 bg-muted/20">
          <div className="flex items-center gap-2">
            {type === "checkin" ? <LogIn size={14} className="text-primary" /> : <LogOut size={14} className="text-primary" />}
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
            <ShareWhatsAppInspectionButton bookingId={booking.id} type={type} size="sm" variant="outline" />
            <ShareInspectionButton bookingId={booking.id} type={type} size="sm" variant="ghost" label="Link" />
          </div>
        </div>

        <CardContent className="p-4 sm:p-5 space-y-5">
          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard icon={Gauge} label="Odômetro" value={insp.odometer_reading ? `${insp.odometer_reading.toLocaleString()} mi` : "—"} />
            <MetricCard icon={Fuel} label="Combustível" value={insp.fuel_level ? (FUEL_LABELS[insp.fuel_level] || insp.fuel_level) : "—"} />
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
                {photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    onClick={() => setLightbox({
                      items: photos.map((p) => ({ url: p.url, label: positionLabel(p.position) })),
                      index: idx,
                    })}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-border/30 bg-muted/30 hover:border-primary/40 transition-all"
                  >
                    <SignedImage value={photo.url} alt={positionLabel(photo.position)} className="w-full h-full object-contain" loading="lazy" />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Image size={16} className="text-foreground" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm px-2 py-1">
                      <span className="text-[10px] text-foreground font-medium truncate block">{positionLabel(photo.position)}</span>
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
                        <span className="text-xs font-medium text-foreground">{normalizeDamageText(d.description || "")}</span>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 shrink-0 ${
                          d.severity === "heavy" ? "border-red-500/30 text-red-500" :
                          d.severity === "medium" ? "border-amber-500/30 text-amber-600" :
                          "border-yellow-500/30 text-yellow-600"
                        }`}>
                          {d.severity === "heavy" ? "Grave" : d.severity === "medium" ? "Média" : "Leve"}
                        </Badge>
                      </div>
                      {d.position && <span className="text-[10px] text-muted-foreground">{positionLabel(d.position)}</span>}
                    </div>
                    {d.photoUrl && (
                      <button onClick={() => setLightbox({ items: [{ url: d.photoUrl, label: d.position ? positionLabel(d.position) : "Avaria" }], index: 0 })} className="w-10 h-10 rounded-md overflow-hidden border border-border/30 bg-muted/30 shrink-0">
                        <SignedImage value={d.photoUrl} alt="" className="w-full h-full object-contain" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {accessoryEntries.map(([key, val]) => (
                  <div key={key} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs border ${
                    val ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" : "border-red-500/20 bg-red-500/5 text-red-500"
                  }`}>
                    {val ? <Check size={11} /> : <XIcon size={11} />}
                    <span className="truncate capitalize">{accessoryLabel(key)}</span>
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
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Cliente</p>
                    <img src={insp.customer_signature} alt="Assinatura do cliente" className="w-full h-16 object-contain" />
                  </div>
                )}
                {insp.agent_signature && (
                  <div className="rounded-lg border border-border/30 bg-white p-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">Agente</p>
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
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-0">

      {/* Photo lightbox with gallery navigation */}
      {lightbox && (
        <PhotoLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate("/admin/bookings")} className="hover:text-foreground transition-colors">Reservas</button>
        <ChevronRight size={12} />
        <span className="text-foreground font-medium">{formatPersonName(booking.customer_name)}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 rounded-2xl border border-border/40 bg-card/50 p-4 shadow-sm sm:p-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <PersonAvatar name={booking.customer_name} size="lg" tone="gold" />
              <h1 className="text-xl sm:admin-h1 text-2xl leading-tight break-words min-w-0">
                {formatPersonName(booking.customer_name)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2">
              {booking.booking_number && (
                <Badge variant="outline" className="text-[10px] px-2 py-1 font-mono tabular-nums">
                  {booking.booking_number}
                </Badge>
              )}
              {booking.turo_reservation_code && (
                <a
                  href={`https://turo.com/us/en/reservation/${booking.turo_reservation_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir reserva na Turo"
                >
                  <Badge variant="outline" className="text-[10px] px-2 py-1 font-mono tabular-nums border-primary/40 text-primary hover:bg-primary/10 cursor-pointer">
                    Turo #{booking.turo_reservation_code}
                  </Badge>
                </a>
              )}
              <Badge className={`${sc.color} border text-[10px] px-3 py-1 font-semibold whitespace-nowrap`}>{sc.label}</Badge>
              {(() => {
                const cs = contractStatusConfig[booking.contract_status || "not_sent"] || contractStatusConfig.not_sent;
                const badge = (
                  <Badge className={`${cs.cls} border text-[10px] px-3 py-1 font-semibold whitespace-nowrap`}>{cs.label}</Badge>
                );
                if (booking.contract_status === "failed" && booking.contract_error) {
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><span className="inline-flex max-w-full">{badge}</span></TooltipTrigger>
                        <TooltipContent className="max-w-sm text-xs">{booking.contract_error}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
                return badge;
              })()}
              {(() => {
                const ps = booking.payment_status || "pending";
                const isTuro = !!(booking.turo_reservation_code || (booking as any).addons?.turo_reservation_id);
                const cls = ps === "paid"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30";
                const label = ps === "paid"
                  ? "Pagamento OK"
                  : isTuro ? "Pagamento pós check-out" : "Pagamento pendente";
                return <Badge className={`${cls} border text-[10px] px-3 py-1 font-semibold whitespace-nowrap`}>{label}</Badge>;
              })()}
            </div>
          </div>

          <div className="grid w-full grid-cols-[1fr_auto_auto] gap-px overflow-hidden rounded-xl border border-border/40 bg-border/40 sm:inline-grid sm:w-auto sm:min-w-[430px] sm:grid-cols-[1.35fr_0.65fr_0.9fr] sm:gap-0 sm:bg-background/60">
            <div className="min-w-0 bg-background px-3 py-2 sm:bg-transparent sm:border-r sm:border-border/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Período</p>
              <p className="truncate text-xs sm:text-xs font-medium text-foreground tabular-nums" title={`${pickup.toLocaleDateString("pt-BR")} → ${returnD.toLocaleDateString("pt-BR")}`}>
                {pickup.toLocaleDateString("pt-BR")} → {returnD.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="min-w-0 bg-background px-3 py-2 sm:bg-transparent sm:border-r sm:border-border/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Dias</p>
              <p className="truncate text-xs sm:text-xs font-medium text-foreground tabular-nums">{days}</p>
            </div>
            {!hideFin && (
              <div className="min-w-0 bg-background px-3 py-2 sm:bg-transparent">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">Total</p>
                <p className="truncate text-xs sm:text-xs font-medium text-foreground tabular-nums">{booking.total_price ? `$${booking.total_price.toFixed(2)}` : "—"}</p>
              </div>
            )}
          </div>

        </div>

        <div className="w-full lg:w-auto lg:min-w-[360px] space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            {booking.customer_phone && (
              <a
                href={`https://wa.me/${booking.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${formatPersonName(booking.customer_name) || ""}, aqui é da GoDrive sobre sua reserva ${booking.booking_number || ""}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp: ${booking.customer_phone}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400 sm:min-h-9"
              >
                <MessageCircle size={13} />
                <span className="leading-tight">WhatsApp Cliente</span>
              </a>
            )}
            <button
              onClick={() => navigate(`/admin/inspection/${booking.id}?type=checkin`)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 sm:min-h-9"
            >
              <LogIn size={13} /> Entrega
            </button>
            <button
              onClick={() => navigate(`/admin/inspection/${booking.id}?type=checkout`)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 sm:min-h-9"
            >
              <LogOut size={13} /> Devolução
            </button>
            {canSendContract && ["not_sent", "failed"].includes(booking.contract_status || "not_sent") && canActuallySendContract && (
              <button
                onClick={handleSendContract}
                disabled={sendingContract}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
              >
                {sendingContract ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {sendingContract ? "Enviando..." : "Enviar Contrato"}
              </button>
            )}
          </div>

          {canSendContract && ["not_sent", "failed"].includes(booking.contract_status || "not_sent") && !canActuallySendContract && (
            <div className="grid gap-2 sm:flex sm:justify-end">
              <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle size={12} className="shrink-0" />
                <span className="min-w-0">Cliente sem {missingContractFields.join(", ")}</span>
              </div>
              <button
                onClick={handleSendContract}
                disabled
                title={`Preencha: ${missingContractFields.join(", ")}`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={13} />
                Enviar Contrato
              </button>
            </div>
          )}

          <div className={`grid gap-2 sm:flex sm:justify-end ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            <button
              onClick={() => navigate(`/admin/inspection/report/${booking.id}`)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border/40 bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-9 sm:min-h-0 sm:w-9 sm:px-0"
              title="Ver laudo"
              aria-label="Ver laudo"
            >
              <FileText size={15} />
              <span className="sm:sr-only">Laudo</span>
            </button>
            <button
              onClick={() => setIncidentOpen(true)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-3 text-xs font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 sm:h-9 sm:min-h-0 sm:w-9 sm:px-0"
              title="Registrar ocorrência"
              aria-label="Registrar ocorrência"
            >
              <AlertTriangle size={15} />
              <span className="sm:sr-only">Ocorrência</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/90 sm:h-9 sm:min-h-0 sm:w-9 sm:px-0"
                title="Editar reserva"
                aria-label="Editar reserva"
              >
                <Pencil size={15} />
                <span className="sm:sr-only">Editar</span>
              </button>
            )}
          </div>
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

      <BookingIncidentDialog
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        bookingId={booking.id}
        vehicleId={booking.vehicle_id}
        onSaved={reload}
      />

      {/* Executive dossier: single-column vertical flow */}
      <div className="max-w-3xl mx-auto w-full space-y-10 sm:space-y-14 pt-2 sm:pt-4">

        {/* Itinerário */}
        <section className="relative pl-8">
          <div className="absolute left-[3px] top-2 bottom-2 w-px bg-gradient-to-b from-primary via-primary/20 to-transparent" />
          <h2 className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-8">Itinerário</h2>

          <div className="space-y-10">
            {(() => {
              const renderLoc = (
                kind: "pickup" | "return",
                label: string,
                accent: string,
                dotClass: string,
                rawAddress: string | null,
                date: Date,
              ) => {
                const addr = (rawAddress || "").trim();
                const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
                let primary = parts[0] || (addr || "—");
                let terminal: string | null = null;
                // Extract terminal info from any part (e.g. "Terminal B", "Terminal 2", "Terminal Norte")
                const terminalRegex = /\bTerminal\b[\s\-]*[A-Za-z0-9ÀÁÂÃÉÊÍÓÔÕÚÇ]+/i;
                const terminalIdx = parts.findIndex((p) => terminalRegex.test(p));
                if (terminalIdx >= 0) {
                  const match = parts[terminalIdx].match(terminalRegex);
                  if (match) {
                    terminal = match[0].replace(/\s+/g, " ").trim();
                    // Remove the terminal token from that part
                    parts[terminalIdx] = parts[terminalIdx].replace(terminalRegex, "").replace(/^[\s\-–—,]+|[\s\-–—,]+$/g, "");
                    if (terminalIdx === 0) {
                      primary = parts[0] || primary;
                    }
                  }
                }
                const secondary = parts.slice(1).filter(Boolean).join(", ");
                return (
                  <div key={kind} className="relative">
                    <div className={`absolute -left-[33px] top-1.5 w-2 h-2 rounded-full border-2 bg-background ${dotClass}`} />
                    <div className="space-y-2">
                      <p className={`text-[10px] font-medium uppercase tracking-wider ${accent}`}>{label}</p>
                      <h3 className="text-lg font-semibold text-foreground leading-tight flex items-baseline gap-2 flex-wrap">
                        <span>{primary}</span>
                        {terminal && (
                          <span className="text-sm font-normal text-muted-foreground">
                            <span className="mr-1.5">–</span>{terminal}
                          </span>
                        )}
                      </h3>
                      {secondary && (
                        <p className="text-xs text-muted-foreground leading-snug max-w-xl">{secondary}</p>
                      )}
                      <p className="text-xs text-muted-foreground tabular-nums pt-0.5">{date.toLocaleDateString("pt-BR")}</p>
                      {addr && addr !== "—" && (
                        <div className="pt-2 max-w-md">
                          <MiniLocationMap address={addr} height={140} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {renderLoc("pickup", "Retirada", "text-primary", "border-primary", booking.pickup_location, pickup)}
                  {renderLoc("return", "Devolução", "text-muted-foreground", "border-border", booking.return_location, returnD)}
                </>
              );
            })()}
          </div>
        </section>

        {/* Cliente */}
        <section>
          <h2 className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-6">Cliente</h2>
          {customer ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-6 sm:gap-x-8 md:gap-x-12">
                <div>
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">Nome</label>
                  <p className="text-sm font-medium text-foreground break-words">{formatPersonName(customer.full_name) || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">E-mail</label>
                  <p className="text-sm font-medium text-foreground break-all">{customer.email || "—"}</p>
                </div>

                <div>
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">Telefone</label>
                  <p className="text-sm font-medium text-foreground tabular-nums">{customer.phone || "—"}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">Nacionalidade</label>
                  <p className="text-sm font-medium text-foreground">{customer.nationality || "—"}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">Documento</label>
                  <p className="text-sm font-medium text-foreground tabular-nums">{customer.document_number || "—"}</p>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mb-1.5">CNH</label>
                  <p className="text-sm font-medium text-foreground tabular-nums">{customer.driver_license || "—"}</p>
                </div>
              </div>
              {customer.notes && (
                <p className="mt-6 text-xs text-muted-foreground italic leading-relaxed">{customer.notes}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-4">Cliente não vinculado</p>
          )}
        </section>

        {/* Veículo */}
        <section className="bg-card border border-border/40 rounded-2xl p-5 sm:p-8 shadow-sm">
          {vehicle ? (
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-stretch">

              <div className="w-full md:w-1/2 space-y-6">
                <div>
                  <h2 className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">Veículo</h2>
                  <h3 className="admin-h1 text-2xl">{vehicle.name}</h3>
                  <p className="text-primary font-medium mt-1 uppercase tracking-widest text-xs">
                    {vehicle.year ? `${vehicle.year} • ` : ""}{vehicle.category}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/30">
                    <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">Transmissão</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{vehicle.transmission}</p>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/30">
                    <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">Combustível</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{vehicle.fuel}</p>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/30">
                    <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">Passageiros</p>
                    <p className="text-xs font-semibold text-foreground tabular-nums mt-0.5">{vehicle.passengers}</p>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/30">
                    <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">Malas</p>
                    <p className="text-xs font-semibold text-foreground tabular-nums mt-0.5">{vehicle.bags}</p>
                  </div>
                </div>
              </div>

              {!hideFin && (
                <div className="w-full md:w-1/2 flex flex-col items-center justify-center md:border-l border-t md:border-t-0 border-border/40 md:pl-8 pt-6 md:pt-0 py-2 md:py-4">
                  <p className="admin-label mb-2">Valor da Diária</p>
                  <p className="text-3xl sm:text-4xl font-light tabular-nums text-foreground tracking-[-0.02em]">
                    <span className="text-base sm:text-lg font-normal text-muted-foreground/80 mr-1">$</span>
                    {vehicle.daily_price_usd.toFixed(2)}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">Veículo não vinculado</p>
          )}
        </section>

        {/* Resumo Financeiro & Observações */}
        <section className="space-y-6 pt-2">
          {!hideFin && (
          <h2 className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Resumo Financeiro & Observações
          </h2>
          )}

          {!hideFin && (<>
          <div className="space-y-1">
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">Duração da reserva</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{days} dia{days > 1 ? "s" : ""}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">Condutor adicional</span>
              <span className="text-sm font-semibold text-foreground">{booking.extra_driver ? "Sim" : "Não"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">Idade do condutor</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {booking.driver_age ? `${booking.driver_age} anos` : "—"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground">Reserva criada em</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {new Date(booking.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between items-baseline py-5">
              <span className="text-base font-medium text-foreground">Total da Reserva</span>
              <span className="text-2xl font-medium tabular-nums text-primary">
                {booking.total_price ? `$${booking.total_price.toFixed(2)}` : "—"}
              </span>
            </div>
          </div>

          {/* Detalhamento do pagamento — instrução para o operador */}
          {(() => {
            const total = Number(booking.total_price || 0);
            const deposit = Number(booking.deposit_amount || 0);
            const franchise = Number(booking.franchise_amount || 0);
            const ps = (booking.payment_status || "pending").toLowerCase();
            const isPaid = ps === "paid";
            const isRefunded = ps === "refunded";
            const isFailed = ps === "failed";
            const isTuro = !!(booking.turo_reservation_code || (booking as any).addons?.turo_reservation_id);
            const balanceDue = isPaid ? 0 : total;

            const statusMap: Record<string, { label: string; tone: string; dot: string }> = {
              paid: { label: "Pago com antecedência", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
              pending: { label: isTuro ? "Pagamento pós check-out" : "Pagamento pendente", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" },
              failed: { label: "Pagamento falhou", tone: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30", dot: "bg-red-500" },
              refunded: { label: "Reembolsado", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
              refund_partial: { label: "Reembolso parcial", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
            };
            const st = statusMap[ps] || statusMap.pending;

            const methodMap: Record<string, string> = {
              card: "Cartão",
              credit_card: "Cartão de crédito",
              debit_card: "Cartão de débito",
              pix: "PIX",
              cash: "Dinheiro",
              bank_transfer: "Transferência",
              cambioreal: "Câmbio Real",
            };

            return (
              <div className="mt-2 rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-border/30 flex items-center justify-between gap-3">
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Detalhamento do pagamento
                  </h3>
                  <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-md border ${st.tone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                <div className="divide-y divide-border/30">
                  <div className="flex justify-between py-2 px-4 sm:px-5">
                    <span className="text-sm text-muted-foreground">Valor total</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 px-4 sm:px-5">
                    <span className="text-sm text-muted-foreground">Já pago</span>
                    <span className={`text-sm font-semibold tabular-nums ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {isPaid ? `$${total.toFixed(2)}` : "$0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 px-4 sm:px-5">
                    <span className="text-sm text-muted-foreground">Forma de pagamento</span>
                    <span className="text-sm font-semibold text-foreground">
                      {booking.payment_method ? (methodMap[booking.payment_method] || booking.payment_method) : "—"}
                    </span>
                  </div>
                  {booking.paid_at && (
                    <div className="flex justify-between py-2 px-4 sm:px-5">
                      <span className="text-sm text-muted-foreground">Pago em</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {new Date(booking.paid_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 px-4 sm:px-5">
                    <span className="text-sm text-muted-foreground">Caução {deposit > 0 ? "(reter na retirada)" : ""}</span>
                    <span className={`text-sm font-semibold tabular-nums ${deposit > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {deposit > 0 ? `$${deposit.toFixed(2)}` : "Não aplicável"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 px-4 sm:px-5">
                    <span className="text-sm text-muted-foreground">Franquia (responsabilidade)</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {franchise > 0 ? `$${franchise.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>

                {/* Banner de orientação ao operador */}
                <div className={`px-4 sm:px-5 py-3 border-t border-border/30 ${
                  balanceDue > 0 || deposit > 0
                    ? "bg-amber-500/[0.06]"
                    : "bg-emerald-500/[0.06]"
                }`}>
                  {balanceDue > 0 ? (
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium text-amber-700 dark:text-amber-400">
                          {isTuro
                            ? <>Pagamento pós check-out (Turo): <span className="tabular-nums">${balanceDue.toFixed(2)}</span></>
                            : <>Cobrar na retirada: <span className="tabular-nums">${balanceDue.toFixed(2)}</span></>}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {isTuro
                            ? <>Repasse da Turo cai após o check-out. Será marcado como pago automaticamente ao finalizar a inspeção de devolução.</>
                            : <>O cliente ainda não pagou a reserva. Confirme o pagamento antes de entregar o veículo{deposit > 0 ? <> e retenha a caução de <span className="tabular-nums font-semibold text-foreground">${deposit.toFixed(2)}</span></> : ""}.</>}
                        </p>
                      </div>
                    </div>
                  ) : isRefunded ? (
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={15} className="text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium text-sky-700 dark:text-sky-400">Reserva reembolsada</p>
                        <p className="text-muted-foreground mt-0.5">Confirme com a gerência antes de prosseguir com a entrega.</p>
                      </div>
                    </div>
                  ) : isFailed ? (
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={15} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium text-red-700 dark:text-red-400">Pagamento falhou</p>
                        <p className="text-muted-foreground mt-0.5">Não entregue o veículo sem confirmar nova cobrança.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">
                          Reserva quitada — nenhum valor a cobrar na retirada.
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {deposit > 0
                            ? <>Apenas retenha a caução de <span className="tabular-nums font-semibold text-foreground">${deposit.toFixed(2)}</span> no cartão do cliente.</>
                            : "Pode liberar o veículo após a vistoria de entrega."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          </>)}


          {booking.notes && (
            <div className="bg-muted/30 p-4 sm:p-6 rounded-xl border border-border/30">
              <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Observações
              </label>
              <p className="text-sm italic text-muted-foreground leading-relaxed">{booking.notes}</p>
            </div>
          )}
        </section>
      </div>

      {/* Full Inspection sections */}
      <FullInspectionSection insp={checkin} label="Checkin (Entrega)" type="checkin" />
      <FullInspectionSection insp={checkout} label="Checkout (Devolução)" type="checkout" />

      {/* Comparison bar */}
      {checkin && checkout && (
        <Card className="bg-card/80 border-border/30">
          <CardContent className="p-4 sm:p-5">
            <SectionTitle>Comparativo Entrega × Devolução</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">

              <MetricCard
                icon={Gauge}
                label="Milhas Rodadas"
                value={checkin.odometer_reading && checkout.odometer_reading
                  ? `${(checkout.odometer_reading - checkin.odometer_reading).toLocaleString()} mi`
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

      <BookingEpassTolls bookingId={booking.id} transponder={vehicle?.e_pass_transponder} />
    </div>
  );
}
