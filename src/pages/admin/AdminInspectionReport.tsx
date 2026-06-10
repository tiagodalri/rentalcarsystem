import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, FileText, Gauge, Fuel, Camera, AlertTriangle, ClipboardCheck,
  CheckCircle2, XCircle, Printer, FileSignature, DollarSign, ShieldAlert,
  Calendar, MapPin, User, Car, Loader2, ExternalLink, Download
} from "lucide-react";

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};
const FUEL_PCT: Record<string, number> = {
  empty: 0, "1/8": 12.5, "1/4": 25, "3/8": 37.5,
  "1/2": 50, "5/8": 62.5, "3/4": 75, "7/8": 87.5, full: 100,
};
const ACCESSORIES_LABELS: Record<string, string> = {
  spare_tire: "Estepe", jack: "Macaco", triangle: "Triângulo",
  fire_extinguisher: "Extintor", first_aid: "Kit Primeiros Socorros",
  manual: "Manual do Veículo", floor_mats: "Tapetes", antenna: "Antena",
  hubcaps: "Calotas", wiper_blades: "Palhetas", charger_cable: "Cabo Carregador",
  sunshade: "Protetor Solar",
};
const SEVERITY_LABELS: Record<string, string> = {
  light: "Leve", medium: "Moderada", heavy: "Grave",
};
const SEVERITY_COLOR: Record<string, string> = {
  light: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  medium: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  heavy: "bg-destructive/10 text-destructive border-destructive/30",
};

const fmtName = (n?: string | null) => {
  if (!n) return "—";
  const small = new Set(["da","de","do","das","dos","e","di","du"]);
  return n.toLowerCase().split(/\s+/).map(w =>
    small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");
};
const fmtMoney = (v?: number | null) =>
  typeof v === "number" ? v.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

export default function AdminInspectionReport() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [checkin, setCheckin] = useState<any>(null);
  const [checkout, setCheckout] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      setLoading(true);
      const [bRes, ciRes, coRes, incRes, txRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("id", bookingId).single(),
        supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", "checkin").maybeSingle(),
        supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", "checkout").maybeSingle(),
        supabase.from("vehicle_incidents").select("*").eq("booking_id", bookingId).order("incident_date", { ascending: true }),
        supabase.from("financial_transactions").select("*").eq("booking_id", bookingId).eq("is_cancelled", false).order("transaction_date", { ascending: true }),
      ]);
      setBooking(bRes.data);
      setCheckin(ciRes.data);
      setCheckout(coRes.data);
      setIncidents(incRes.data || []);
      setTransactions(txRes.data || []);
      if (bRes.data?.vehicle_id) {
        const { data: v } = await supabase.from("vehicles").select("*").eq("id", bRes.data.vehicle_id).single();
        setVehicle(v);
      }
      setLoading(false);
    })();
  }, [bookingId]);

  const odometerDiff = checkin?.odometer_reading && checkout?.odometer_reading
    ? checkout.odometer_reading - checkin.odometer_reading : null;
  const fuelDiff = checkin?.fuel_level && checkout?.fuel_level
    ? (FUEL_PCT[checkout.fuel_level] ?? 0) - (FUEL_PCT[checkin.fuel_level] ?? 0) : null;

  const checkinDamages = (checkin?.damages as any[]) || [];
  const checkoutDamages = (checkout?.damages as any[]) || [];
  const newDamages = checkoutDamages.filter(
    (d: any) => !checkinDamages.some((ci: any) => ci.position === d.position && ci.description === d.description)
  );

  const checkinAcc = (checkin?.accessories_check as Record<string, boolean>) || {};
  const checkoutAcc = (checkout?.accessories_check as Record<string, boolean>) || {};
  const missingAcc = Object.keys(ACCESSORIES_LABELS).filter(
    (k) => checkinAcc[k] !== false && checkoutAcc[k] === false
  );

  const extraCharges = useMemo(() => {
    const items: { label: string; amount: number; reason: string }[] = [];
    // Fuel deficit
    if (fuelDiff !== null && fuelDiff < 0) {
      const liters = Math.ceil((Math.abs(fuelDiff) / 100) * 60); // tanque ~60L
      items.push({
        label: "Reabastecimento",
        amount: liters * 1.2,
        reason: `Devolvido com ${Math.abs(fuelDiff)}% a menos de combustível`,
      });
    }
    // New damages
    newDamages.forEach((d: any) => {
      const cost = d.severity === "heavy" ? 850 : d.severity === "medium" ? 320 : 90;
      items.push({
        label: `Avaria: ${d.position}`,
        amount: cost,
        reason: `${SEVERITY_LABELS[d.severity] || d.severity} — ${d.description || "Reparo necessário"}`,
      });
    });
    // Missing accessories
    missingAcc.forEach((k) => {
      items.push({
        label: `Acessório faltante: ${ACCESSORIES_LABELS[k]}`,
        amount: 75,
        reason: "Reposição obrigatória",
      });
    });
    return items;
  }, [fuelDiff, newDamages, missingAcc]);

  const totalExtras = extraCharges.reduce((s, i) => s + i.amount, 0);

  const reportNumber = booking?.booking_number
    ? `LDO-${booking.booking_number.replace(/^ZRC-/, "")}`
    : "LDO-PEND";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-8 text-center text-muted-foreground">Reserva não encontrada.</div>
    );
  }

  const hasCheckin = !!checkin?.completed_at;
  const hasCheckout = !!checkout?.completed_at;
  const isComplete = hasCheckin && hasCheckout;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 print:p-0">
      {/* Top bar - hidden on print */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")}>
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Laudo de Conclusão de Serviço
          </p>
          <h1 className="text-2xl font-bold text-foreground">{reportNumber}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer size={14} className="mr-1.5" /> Imprimir / PDF
        </Button>
      </div>

      {/* Header card */}
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Zeus Rental Car</p>
              <h2 className="text-xl font-bold text-foreground mt-0.5">Laudo Completo de Serviço</h2>
              <p className="text-xs text-muted-foreground mt-1">Documento Nº {reportNumber} • Reserva {booking.booking_number}</p>
            </div>
            <Badge className={isComplete ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"}>
              {isComplete ? <><CheckCircle2 size={12} className="mr-1" /> Concluído</> : <><AlertTriangle size={12} className="mr-1" /> Em aberto</>}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <User size={11} /> Cliente
              </p>
              <p className="font-medium text-foreground">{fmtName(booking.customer_name)}</p>
              <p className="text-xs text-muted-foreground">{booking.customer_email || "—"}</p>
              <p className="text-xs text-muted-foreground">{booking.customer_phone || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <Car size={11} /> Veículo
              </p>
              <p className="font-medium text-foreground">{vehicle?.name || `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim() || "—"}</p>
              <p className="text-xs text-muted-foreground">Placa: {vehicle?.license_plate || "—"}</p>
              <p className="text-xs text-muted-foreground">Ano: {vehicle?.year || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <Calendar size={11} /> Período
              </p>
              <p className="font-medium text-foreground">{fmtDate(booking.pickup_date)} — {fmtDate(booking.return_date)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10}/> Retirada: {booking.pickup_location || "—"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10}/> Devolução: {booking.return_location || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSignature size={16} className="text-primary" /> Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <Badge variant="outline" className={
                booking.contract_status === "signed"
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                  : booking.contract_status === "sent"
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  : "bg-muted text-muted-foreground"
              }>
                {booking.contract_status === "signed" ? "Assinado" :
                 booking.contract_status === "sent" ? "Aguardando assinatura" :
                 booking.contract_status === "not_sent" ? "Não enviado" : booking.contract_status}
              </Badge>
              {booking.contract_signed_at && (
                <p className="text-xs text-muted-foreground">Assinado em {fmtDateTime(booking.contract_signed_at)}</p>
              )}
            </div>
            {booking.contract_signed_pdf_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={booking.contract_signed_pdf_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-1.5" /> Ver contrato assinado
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inspections side by side */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck size={16} className="text-primary" /> Inspeções
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Entrega (Check-in)", data: checkin, accent: "border-primary/30 bg-primary/[0.03]" },
              { label: "Devolução (Check-out)", data: checkout, accent: "border-border bg-muted/30" },
            ].map((col) => (
              <div key={col.label} className={`rounded-lg border ${col.accent} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{col.label}</p>
                  {col.data?.completed_at ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                      <CheckCircle2 size={10} className="mr-1" /> Realizada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                  )}
                </div>
                {col.data ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Odômetro</p>
                      <p className="font-medium text-foreground tabular-nums">{col.data.odometer_reading?.toLocaleString("pt-BR") || "—"} mi</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Combustível</p>
                      <p className="font-medium text-foreground">{FUEL_LABELS[col.data.fuel_level] || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Avarias</p>
                      <p className="font-medium text-foreground">{((col.data.damages as any[]) || []).length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Fotos</p>
                      <p className="font-medium text-foreground">{((col.data.exterior_photos as any[]) || []).length}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Agente</p>
                      <p className="font-medium text-foreground">{fmtName(col.data.agent_name)}</p>
                      {col.data.completed_at && (
                        <p className="text-[10px] text-muted-foreground">{fmtDateTime(col.data.completed_at)}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Inspeção não realizada.</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diffs */}
      {isComplete && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge size={16} className="text-primary" /> Diferenças do Período
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-md border border-border/40">
              <Gauge size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Milhagem percorrida</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {checkin.odometer_reading?.toLocaleString("pt-BR")} → {checkout.odometer_reading?.toLocaleString("pt-BR")} mi
                </p>
              </div>
              <Badge variant="outline" className="text-base font-bold tabular-nums">
                {odometerDiff !== null ? `+${odometerDiff.toLocaleString("pt-BR")} mi` : "—"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border border-border/40">
              <Fuel size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Combustível</p>
                <p className="text-xs text-muted-foreground">
                  {FUEL_LABELS[checkin.fuel_level]} → {FUEL_LABELS[checkout.fuel_level]}
                </p>
              </div>
              <Badge variant="outline" className={fuelDiff !== null && fuelDiff < 0 ? "text-destructive border-destructive/40" : "text-emerald-700 border-emerald-500/40"}>
                {fuelDiff !== null ? `${fuelDiff > 0 ? "+" : ""}${fuelDiff}%` : "—"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Damages */}
      {isComplete && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-primary" /> Avarias e Danos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pré-existentes (na entrega)</p>
              {checkinDamages.length === 0 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> Veículo entregue sem avarias prévias</p>
              ) : (
                <div className="space-y-1.5">
                  {checkinDamages.map((d: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-2 rounded bg-muted/40 border border-border/30">
                      <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLOR[d.severity] || ""}`}>{SEVERITY_LABELS[d.severity] || d.severity}</Badge>
                      <span className="font-medium text-foreground">{d.position}</span>
                      <span className="text-muted-foreground">— {d.description || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Novas avarias na devolução</p>
              {newDamages.length === 0 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> Nenhuma nova avaria identificada</p>
              ) : (
                <div className="space-y-1.5">
                  {newDamages.map((d: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-2 rounded bg-destructive/5 border border-destructive/20">
                      <XCircle size={12} className="text-destructive shrink-0" />
                      <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLOR[d.severity] || ""}`}>{SEVERITY_LABELS[d.severity] || d.severity}</Badge>
                      <span className="font-medium text-foreground">{d.position}</span>
                      <span className="text-muted-foreground">— {d.description || "—"}</span>
                      {d.photoUrl && <img src={d.photoUrl} alt="" className="w-10 h-10 rounded object-cover ml-auto"/>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {missingAcc.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Acessórios faltantes na devolução</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingAcc.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/30">
                        {ACCESSORIES_LABELS[k]}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Photo comparison */}
      {isComplete && (checkin?.exterior_photos as any[])?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera size={16} className="text-primary" /> Comparação Fotográfica
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {(checkin.exterior_photos as any[])
              .filter((p: any) => !p.position?.startsWith("__"))
              .map((ciPhoto: any) => {
                const coPhoto = (checkout?.exterior_photos as any[])?.find((p: any) => p.position === ciPhoto.position);
                return (
                  <div key={ciPhoto.id || ciPhoto.position} className="space-y-1.5">
                    <p className="text-xs font-medium text-foreground">{ciPhoto.position}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Entrega</p>
                        <img src={ciPhoto.url} alt="" className="w-full aspect-[4/3] object-cover rounded border border-border/40" loading="lazy" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Devolução</p>
                        {coPhoto ? (
                          <img src={coPhoto.url} alt="" className="w-full aspect-[4/3] object-cover rounded border border-border/40" loading="lazy" />
                        ) : (
                          <div className="w-full aspect-[4/3] rounded border-2 border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert size={16} className="text-primary" /> Sinistros e Ocorrências ({incidents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-3 rounded-md border border-border/40 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{inc.title}</p>
                  <Badge variant="outline" className={SEVERITY_COLOR[inc.severity] || ""}>{SEVERITY_LABELS[inc.severity] || inc.severity}</Badge>
                </div>
                {inc.description && <p className="text-xs text-muted-foreground">{inc.description}</p>}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{fmtDate(inc.incident_date)}</span>
                  <span>•</span>
                  <span>{inc.type}</span>
                  <span>•</span>
                  <span className="tabular-nums">{fmtMoney(Number(inc.actual_cost || inc.estimated_cost || 0))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Financial */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign size={16} className="text-primary" /> Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Valor da Reserva</p>
              <p className="font-semibold text-foreground tabular-nums">{fmtMoney(Number(booking.total_price || 0))}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Caução</p>
              <p className="font-semibold text-foreground tabular-nums">{fmtMoney(Number(booking.deposit_amount || 0))}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Franquia</p>
              <p className="font-semibold text-foreground tabular-nums">{fmtMoney(Number(booking.franchise_amount || 0))}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Pagamento</p>
              <p className="font-semibold text-foreground capitalize">{booking.payment_status || "—"}</p>
            </div>
          </div>

          {extraCharges.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cobranças Adicionais</p>
                <div className="space-y-1.5">
                  {extraCharges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/40 border border-border/30">
                      <div>
                        <p className="font-medium text-foreground">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground">{c.reason}</p>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{fmtMoney(c.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm pt-2 mt-2 border-t border-border/30">
                    <span className="font-semibold text-foreground">Total de cobranças extras</span>
                    <span className="font-bold text-destructive tabular-nums">{fmtMoney(totalExtras)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {transactions.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Lançamentos Financeiros</p>
                <div className="space-y-1.5">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded border border-border/30">
                      <div>
                        <p className="font-medium text-foreground">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(t.transaction_date)} • {t.type}</p>
                      </div>
                      <span className={`font-semibold tabular-nums ${t.type === "income" ? "text-emerald-700" : "text-destructive"}`}>
                        {t.type === "income" ? "+" : "−"}{fmtMoney(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {(checkin?.notes || checkout?.notes) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {checkin?.notes && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Entrega</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{checkin.notes}</p>
              </div>
            )}
            {checkout?.notes && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Devolução</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{checkout.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signatures */}
      {isComplete && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSignature size={16} className="text-primary" /> Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Entrega", data: checkin },
                { label: "Devolução", data: checkout },
              ].map((s) => (
                <div key={s.label} className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{s.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">Cliente</p>
                      {s.data?.customer_signature ? (
                        <img src={s.data.customer_signature} alt="" className="w-full h-20 object-contain bg-white rounded border border-border/40" />
                      ) : (
                        <div className="h-20 rounded border-2 border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">Agente Zeus</p>
                      {s.data?.agent_signature ? (
                        <img src={s.data.agent_signature} alt="" className="w-full h-20 object-contain bg-white rounded border border-border/40" />
                      ) : (
                        <div className="h-20 rounded border-2 border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{fmtName(s.data?.agent_name)} • {fmtDateTime(s.data?.completed_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border/30">
        Laudo gerado em {fmtDateTime(new Date().toISOString())} • Zeus Rental Car • Documento {reportNumber}
      </div>
    </div>
  );
}
