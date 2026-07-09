import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, FileText, Gauge, Fuel, Camera, AlertTriangle, ClipboardCheck,
  CheckCircle2, XCircle, Printer, FileSignature, DollarSign, ShieldAlert,
  Calendar, MapPin, User, Car, Loader2, ExternalLink, ArrowRight,
  TrendingUp, TrendingDown, Minus, Sparkles, Hash, Phone, Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import zeusLogo from "@/assets/zeus-logo-hd.png";
import { SignedImage } from "@/components/admin/SignedImage";
import { normalizeDamageText } from "@/lib/damageTextNormalizer";
import { ShareInspectionButton } from "@/components/admin/ShareInspectionButton";

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};
const FUEL_PCT: Record<string, number> = {
  empty: 0, "1/8": 12.5, "1/4": 25, "3/8": 37.5,
  "1/2": 50, "5/8": 62.5, "3/4": 75, "7/8": 87.5, full: 100,
};
const ACCESSORIES_LABELS: Record<string, string> = {
  jack: "Macaco", antenna: "Antena", first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe", triangle: "Triângulo", floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};
const SEVERITY_LABELS: Record<string, string> = {
  light: "Leve", medium: "Moderada", heavy: "Grave",
};
const SEVERITY_COLOR: Record<string, string> = {
  light: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  medium: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  heavy: "bg-destructive/10 text-destructive border-destructive/30",
};

const CONTRACT_BADGE: Record<string, { label: string; cls: string }> = {
  signed: { label: "Assinado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  sent: { label: "Aguardando assinatura", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  partially_signed: { label: "Parcialmente assinado", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  not_sent: { label: "Opcional", cls: "bg-muted text-muted-foreground border-border" },
  generating: { label: "Gerando", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive border-destructive/30" },
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
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

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
      // Pre-warm signed URLs for all inspection photos so the gallery renders instantly.
      try {
        const urls: string[] = [];
        for (const i of [ciRes.data, coRes.data]) {
          if (!i) continue;
          const ext = Array.isArray((i as any).exterior_photos) ? (i as any).exterior_photos : [];
          for (const p of ext) if (p?.url) urls.push(p.url);
          const dmg = Array.isArray((i as any).damages) ? (i as any).damages : [];
          for (const d of dmg) if (d?.photoUrl) urls.push(d.photoUrl);
        }
        if (urls.length) {
          const { prefetchSignedInspectionUrls } = await import("@/lib/inspectionStorage");
          prefetchSignedInspectionUrls(urls);
        }
      } catch { /* non-fatal */ }
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
    if (fuelDiff !== null && fuelDiff < 0) {
      const liters = Math.ceil((Math.abs(fuelDiff) / 100) * 60);
      items.push({
        label: "Reabastecimento",
        amount: liters * 1.2,
        reason: `Veículo devolvido com ${Math.abs(fuelDiff)}% a menos de combustível.`,
      });
    }
    newDamages.forEach((d: any) => {
      const cost = d.severity === "heavy" ? 850 : d.severity === "medium" ? 320 : 90;
      items.push({
        label: `Avaria: ${d.position}`,
        amount: cost,
        reason: `${SEVERITY_LABELS[d.severity] || d.severity} — ${d.description || "Reparo necessário"}`,
      });
    });
    missingAcc.forEach((k) => {
      items.push({
        label: `Acessório faltante: ${ACCESSORIES_LABELS[k]}`,
        amount: 75,
        reason: "Reposição obrigatória.",
      });
    });
    return items;
  }, [fuelDiff, newDamages, missingAcc]);

  const totalExtras = extraCharges.reduce((s, i) => s + i.amount, 0);

  const reportNumber = booking?.booking_number
    ? `LDO-${booking.booking_number.replace(/^ZRC-/, "")}`
    : "LDO-PEND";

  const hasCheckin = !!checkin?.completed_at;
  const hasCheckout = !!checkout?.completed_at;
  const isComplete = hasCheckin && hasCheckout;

  // Auto-generated "Parecer Técnico"
  const parecer = useMemo(() => {
    if (!isComplete) return null;
    const parts: string[] = [];
    parts.push(
      `O veículo ${vehicle?.name || ""}${vehicle?.license_plate ? ` (placa ${vehicle.license_plate})` : ""} foi entregue a ${fmtName(booking?.customer_name)} em ${fmtDate(booking?.pickup_date)} e devolvido em ${fmtDate(booking?.return_date)}, totalizando ${odometerDiff != null ? `${odometerDiff.toLocaleString("pt-BR")} milhas percorridas` : "o período contratado"}.`
    );
    if (fuelDiff !== null) {
      if (fuelDiff >= 0) parts.push(`O nível de combustível foi devolvido conforme entregue (${FUEL_LABELS[checkin.fuel_level]} → ${FUEL_LABELS[checkout.fuel_level]}), sem necessidade de cobrança de reabastecimento.`);
      else parts.push(`O combustível foi devolvido ${Math.abs(fuelDiff)}% abaixo do entregue (${FUEL_LABELS[checkin.fuel_level]} → ${FUEL_LABELS[checkout.fuel_level]}), gerando cobrança de reabastecimento.`);
    }
    if (newDamages.length === 0) {
      parts.push("A inspeção comparativa não identificou novas avarias no veículo — o estado externo e interno foi mantido conforme entrega.");
    } else {
      const sev = newDamages.reduce((acc: any, d: any) => { acc[d.severity] = (acc[d.severity] || 0) + 1; return acc; }, {});
      const lbl = Object.entries(sev).map(([s, n]) => `${n} ${SEVERITY_LABELS[s] || s}`.toLowerCase()).join(", ");
      parts.push(`Foram identificadas ${newDamages.length} nova(s) avaria(s) na devolução (${lbl}), todas documentadas fotograficamente e com cobrança discriminada abaixo.`);
    }
    if (missingAcc.length > 0) parts.push(`Os seguintes acessórios não retornaram com o veículo: ${missingAcc.map(k => ACCESSORIES_LABELS[k]).join(", ")}.`);
    if (incidents.length > 0) parts.push(`Durante o período foram registrados ${incidents.length} evento(s) operacional(is) (sinistro/multa/ocorrência), detalhados na seção correspondente.`);
    if (totalExtras > 0) parts.push(`Total de cobranças adicionais apuradas: ${fmtMoney(totalExtras)}, a serem deduzidos da caução de ${fmtMoney(Number(booking?.deposit_amount || 0))}.`);
    else parts.push(`Nenhuma cobrança adicional foi apurada. A caução de ${fmtMoney(Number(booking?.deposit_amount || 0))} será integralmente devolvida em até ${booking?.deposit_refund_deadline_days || booking?.deposit_refund_days || 7} dias úteis.`);
    return parts.join(" ");
  }, [isComplete, vehicle, booking, odometerDiff, fuelDiff, checkin, checkout, newDamages, missingAcc, incidents, totalExtras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return <div className="p-8 text-center text-muted-foreground">Reserva não encontrada.</div>;
  }

  const contractBadge = CONTRACT_BADGE[booking.contract_status || "not_sent"] || CONTRACT_BADGE.not_sent;

  // ============================================================
  // Helpers
  // ============================================================
  const SectionHeader = ({ icon: Icon, title, kicker, action }: { icon: LucideIcon; title: string; kicker?: string; action?: React.ReactNode }) => (
    <div className="mb-4 flex min-h-[88px] items-center justify-between gap-3 border-b border-border/40 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-primary">
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 space-y-1">
          {kicker && <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground leading-[1.15]">{kicker}</p>}
          <h3 className="text-base font-medium text-foreground leading-[1.2]">
            {title}
          </h3>
        </div>
      </div>
      {action}
    </div>
  );

  const TrendBadge = ({ value, suffix, invertColor }: { value: number | null; suffix: string; invertColor?: boolean }) => {
    if (value === null) return <Badge variant="outline">—</Badge>;
    const isUp = value > 0;
    const isDown = value < 0;
    const good = invertColor ? !isDown : isUp;
    const color = isUp || isDown
      ? (good ? "text-emerald-700 border-emerald-500/40 bg-emerald-500/5" : "text-destructive border-destructive/40 bg-destructive/5")
      : "text-muted-foreground border-border";
    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
    return (
      <Badge variant="outline" className={`${color} text-sm font-medium tabular-nums px-2.5 py-1 gap-1`}>
        <Icon size={12} />{value > 0 ? "+" : ""}{value}{suffix}
      </Badge>
    );
  };

  // Inspection column (Entrega / Devolução) with rich empty states
  const InspectionColumn = ({ label, type, data, side }: { label: string; type: "checkin" | "checkout"; data: any; side: "left" | "right" }) => {
    const done = !!data?.completed_at;
    const expectedDate = type === "checkin" ? booking.pickup_date : booking.return_date;
    const accent = side === "left"
      ? "border-l-2 border-l-primary/60 bg-primary/[0.025]"
      : "border-l-2 border-l-foreground/40 bg-muted/30";

    return (
      <div className={`rounded-xl border border-border/40 ${accent} p-5 space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{type === "checkin" ? "ENTREGA" : "DEVOLUÇÃO"}</p>
            <h4 className="text-sm font-semibold text-foreground mt-0.5">{label}</h4>
          </div>
          {done ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">
              <CheckCircle2 size={10} className="mr-1" /> Realizada
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-700 border-amber-500/30">
              <Calendar size={10} className="mr-1" /> Prevista {fmtDate(expectedDate)}
            </Badge>
          )}
        </div>

        {done ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/30 bg-background/60 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1"><Gauge size={9}/> Odômetro</p>
                <p className="text-sm font-medium text-foreground tabular-nums">{data.odometer_reading?.toLocaleString("pt-BR") || "—"} <span className="text-[10px] font-normal text-muted-foreground">mi</span></p>
              </div>
              <div className="rounded-lg border border-border/30 bg-background/60 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1"><Fuel size={9}/> Combustível</p>
                <p className="text-sm font-medium text-foreground">{FUEL_LABELS[data.fuel_level] || "—"}</p>
              </div>
              <div className="rounded-lg border border-border/30 bg-background/60 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={9}/> Avarias</p>
                <p className="text-sm font-medium text-foreground tabular-nums">{((data.damages as any[]) || []).length}</p>
              </div>
              <div className="rounded-lg border border-border/30 bg-background/60 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1"><Camera size={9}/> Fotos</p>
                <p className="text-sm font-medium text-foreground tabular-nums">{((data.exterior_photos as any[]) || []).length}</p>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground border-t border-border/30 pt-2 space-y-0.5">
              <p><User size={9} className="inline mr-1" /> Agente: <span className="font-medium text-foreground">{fmtName(data.agent_name)}</span></p>
              <p><Calendar size={9} className="inline mr-1" /> {fmtDateTime(data.completed_at)}</p>
            </div>
            <div className="pt-1 print:hidden">
              <ShareInspectionButton bookingId={booking.id} type={type} className="w-full justify-center" />
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border/50 p-6 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-muted/60 flex items-center justify-center">
              <ClipboardCheck size={16} className="text-muted-foreground/60" />
            </div>
            <p className="text-xs text-muted-foreground">Inspeção ainda não realizada.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/admin/inspection/${booking.id}?type=${type}`)}
              className="text-xs print:hidden"
            >
              Realizar inspeção <ArrowRight size={12} className="ml-1" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // Layout
  // ============================================================
  return (
    <>
      {/* ============ PRINT STYLES (papel timbrado Sua Marca) ============ */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 22mm 18mm 22mm 18mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0a0a0a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
            font-size: 10pt;
            line-height: 1.45;
          }
          /* Hide entire admin chrome */
          body * { visibility: hidden !important; }
          .laudo-print, .laudo-print * { visibility: visible !important; }
          .laudo-print {
            position: absolute;
            inset: 0;
            left: 0; top: 0; right: 0;
            margin: 0;
            padding: 0;
            max-width: 100% !important;
            width: 100% !important;
            background: #ffffff !important;
          }
          .laudo-letterhead, .laudo-letterhead * { visibility: visible !important; }
          .laudo-footer, .laudo-footer * { visibility: visible !important; }

          /* Running letterhead on every page */
          .laudo-letterhead {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 18mm;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 6mm 18mm 4mm 18mm;
            border-bottom: 0.4pt solid #0a0a0a;
            background: #ffffff;
            z-index: 9999;
          }
          .laudo-footer {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 14mm;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 3mm 18mm 5mm 18mm;
            border-top: 0.4pt solid #d4d4d4;
            background: #ffffff;
            font-size: 7.5pt;
            color: #525252;
            z-index: 9999;
          }
          .laudo-page-number::after {
            content: "Página " counter(page) " de " counter(pages);
          }

          /* Card-level controls */
          .laudo-print .lov-card,
          .laudo-print [class*="rounded-xl"],
          .laudo-print [class*="rounded-lg"] {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .laudo-print h2, .laudo-print h3, .laudo-print h4 {
            page-break-after: avoid;
            break-after: avoid;
          }
          .laudo-print img {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .laudo-print .print-break-before {
            page-break-before: always;
            break-before: page;
          }

          /* Neutralize gradients/shadows for print clarity */
          .laudo-print [class*="bg-gradient"] {
            background: #fafafa !important;
          }
          .laudo-print [class*="shadow"] { box-shadow: none !important; }
          .laudo-print [class*="backdrop-blur"] { backdrop-filter: none !important; }

          /* Force borders to be visible & subtle */
          .laudo-print [class*="border"] {
            border-color: #d4d4d4 !important;
          }

          /* Hide all interactive controls inside the laudo */
          .laudo-print button:not(.allow-print),
          .laudo-print a[role="button"]:not(.allow-print) {
            display: none !important;
          }

          /* Outer wrapper offset so content does not collide with running header/footer */
          .laudo-content {
            margin-top: 8mm;
            margin-bottom: 8mm;
          }
        }
      `}</style>

      {/* ============ LETTERHEAD (print only) ============ */}
      <div className="laudo-letterhead hidden print:flex">
        <div className="flex items-center gap-3">
          <img src={zeusLogo} alt="Sua Marca" style={{ height: "10mm", width: "auto" }} />
          <div className="leading-tight">
            <p style={{ fontSize: "8pt", letterSpacing: "0.2em", textTransform: "uppercase", color: "#737373", fontWeight: 600 }}>
              Sua Marca
            </p>
            <p style={{ fontSize: "7pt", color: "#737373", marginTop: "0.5mm" }}>
              Premium Concierge · +1 555 000 0000
            </p>
          </div>
        </div>
        <div className="text-right leading-tight">
          <p style={{ fontSize: "8pt", letterSpacing: "0.2em", textTransform: "uppercase", color: "#737373", fontWeight: 600 }}>
            Laudo de Serviço
          </p>
          <p style={{ fontSize: "9pt", fontFamily: "ui-monospace, SFMono-Regular, monospace", color: "#0a0a0a", marginTop: "0.5mm" }}>
            {reportNumber}
          </p>
        </div>
      </div>

      {/* ============ FOOTER (print only) ============ */}
      <div className="laudo-footer hidden print:flex">
        <div>
          <p style={{ fontWeight: 600, color: "#0a0a0a" }}>Sua Marca</p>
          <p style={{ marginTop: "0.5mm" }}>www.rentalcarsystem.lovable.app · contato@rentalcarsystem.lovable.app</p>
        </div>
        <div className="text-center">
          <p style={{ letterSpacing: "0.15em", textTransform: "uppercase" }}>Documento Confidencial</p>
          <p style={{ marginTop: "0.5mm" }}>Reserva {booking.booking_number}</p>
        </div>
        <div className="text-right">
          <p className="laudo-page-number" style={{ fontWeight: 600, color: "#0a0a0a" }}></p>
          <p style={{ marginTop: "0.5mm" }}>Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      <div className="laudo-print space-y-5 max-w-5xl mx-auto pb-12 print:max-w-full print:mx-0">
      {/* Top bar */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")} aria-label="Voltar para reservas">
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Laudo de Conclusão de Serviço
          </p>
          <h1 className="admin-h1 text-2xl tabular-nums">{reportNumber}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer size={14} className="mr-1.5" /> Imprimir / PDF
        </Button>
      </div>

      <div className="laudo-content space-y-5">


      {/* ===== EXECUTIVE HEADER ===== */}
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/[0.05] via-background to-background border-b border-border/30 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={12} className="text-primary" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-medium">Sua Marca</p>
              </div>
              <h2 className="admin-h1 text-2xl">Laudo Completo de Serviço</h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 tabular-nums">
                <span><Hash size={10} className="inline mr-0.5" />{reportNumber}</span>
                <span className="text-border">•</span>
                <span>Reserva {booking.booking_number}</span>
              </p>
            </div>
            <Badge className={`text-xs font-semibold px-3 py-1.5 ${isComplete ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" : "bg-amber-500/15 text-amber-700 border-amber-500/30"}`}>
              {isComplete ? <><CheckCircle2 size={12} className="mr-1.5" /> Serviço Concluído</> : <><AlertTriangle size={12} className="mr-1.5" /> Serviço em aberto</>}
            </Badge>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/30 border-b border-border/30">
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Período</p>
            <p className="text-sm font-medium text-foreground tabular-nums">{fmtDate(booking.pickup_date)}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">até {fmtDate(booking.return_date)}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Milhas Rodadas</p>
            <p className="text-sm font-medium text-foreground tabular-nums">{odometerDiff !== null ? `${odometerDiff.toLocaleString("pt-BR")} mi` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">no período</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Novas Avarias</p>
            <p className={`text-sm font-medium tabular-nums ${newDamages.length > 0 ? "text-destructive" : "text-emerald-700"}`}>{newDamages.length}</p>
            <p className="text-[10px] text-muted-foreground">{newDamages.length === 0 ? "nenhuma" : "documentadas"}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Cobranças Extras</p>
            <p className={`text-sm font-medium tabular-nums ${totalExtras > 0 ? "text-destructive" : "text-emerald-700"}`}>{fmtMoney(totalExtras)}</p>
            <p className="text-[10px] text-muted-foreground">{totalExtras > 0 ? "a deduzir" : "caução integral"}</p>
          </div>
        </div>

        {/* Stakeholders */}
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5"><User size={11} /> Cliente</p>
              <p className="font-semibold text-foreground">{fmtName(booking.customer_name)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Mail size={10} />{booking.customer_email || "—"}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} />{booking.customer_phone || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5"><Car size={11} /> Veículo</p>
              <p className="font-semibold text-foreground">{vehicle?.name || `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim() || "—"}</p>
              <p className="text-xs text-muted-foreground">Placa <span className="font-mono">{vehicle?.license_plate || "—"}</span> • {vehicle?.year || "—"}</p>
              <p className="text-xs text-muted-foreground capitalize">{vehicle?.category || ""}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5"><MapPin size={11} /> Logística</p>
              <p className="text-xs text-foreground"><span className="text-muted-foreground">Retirada:</span> {booking.pickup_location || "—"}</p>
              <p className="text-xs text-foreground mt-0.5"><span className="text-muted-foreground">Devolução:</span> {booking.return_location || "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{booking.pickup_time || "—"} → {booking.return_time || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== PARECER TÉCNICO (only when complete) ===== */}
      {parecer && (
        <Card className="border-primary/30 bg-primary/[0.025]">
          <CardContent className="p-6">
            <SectionHeader icon={FileText} title="Parecer Técnico" kicker="Conclusão do Serviço" />
            <p className="text-sm leading-relaxed text-foreground/90">{parecer}</p>
          </CardContent>
        </Card>
      )}

      {/* ===== CONTRATO ===== */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <SectionHeader
            icon={FileSignature}
            title="Contrato de Locação"
            kicker="Documento Jurídico"
            action={booking.contract_signed_pdf_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={booking.contract_signed_pdf_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} className="mr-1.5" /> Abrir PDF
                </a>
              </Button>
            ) : undefined}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Status</p>
              <Badge variant="outline" className={contractBadge.cls}>{contractBadge.label}</Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Enviado em</p>
              <p className="text-sm font-medium text-foreground tabular-nums">{fmtDateTime(booking.contract_sent_at)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Assinado em</p>
              <p className="text-sm font-medium text-foreground tabular-nums">{fmtDateTime(booking.contract_signed_at)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Envelope</p>
              <p className="text-xs font-mono text-muted-foreground truncate" title={booking.clicksign_envelope_id || ""}>{booking.clicksign_envelope_id || "—"}</p>
            </div>
          </div>
          {booking.contract_error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <strong>Erro:</strong> {booking.contract_error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== INSPEÇÕES (lado a lado) ===== */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <SectionHeader icon={ClipboardCheck} title="Inspeções de Entrega e Devolução" kicker="Vistoria Comparativa" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InspectionColumn label="Check-in" type="checkin" data={checkin} side="left" />
            <InspectionColumn label="Check-out" type="checkout" data={checkout} side="right" />
          </div>
        </CardContent>
      </Card>

      {/* ===== DIFERENÇAS DO PERÍODO ===== */}
      {isComplete && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <SectionHeader icon={Gauge} title="Diferenças do Período" kicker="Métricas Comparativas" />
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-background border border-border/40 flex items-center justify-center">
                  <Gauge size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Milhagem percorrida</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {checkin.odometer_reading?.toLocaleString("pt-BR")} → {checkout.odometer_reading?.toLocaleString("pt-BR")} mi
                  </p>
                </div>
                <TrendBadge value={odometerDiff} suffix=" mi" invertColor />
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg border border-border/40 bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-background border border-border/40 flex items-center justify-center">
                  <Fuel size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Nível de combustível</p>
                  <p className="text-xs text-muted-foreground">{FUEL_LABELS[checkin.fuel_level]} → {FUEL_LABELS[checkout.fuel_level]}</p>
                </div>
                <TrendBadge value={fuelDiff} suffix="%" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== AVARIAS ===== */}
      {isComplete && (
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-5">
            <SectionHeader icon={AlertTriangle} title="Avarias e Danos" kicker="Comparativo Estrutural" />

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Pré-existentes (entrega)</p>
              {checkinDamages.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <p className="text-sm text-emerald-700 font-medium">Veículo entregue sem avarias prévias.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {checkinDamages.map((d: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border border-border/30">
                      <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLOR[d.severity] || ""}`}>{SEVERITY_LABELS[d.severity] || d.severity}</Badge>
                      <span className="font-semibold text-foreground">{d.position}</span>
                      <span className="text-muted-foreground">— {normalizeDamageText(d.description || "") || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Novas avarias (devolução)</p>
              {newDamages.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <p className="text-sm text-emerald-700 font-medium">Nenhuma nova avaria identificada.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {newDamages.map((d: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/20">
                      <XCircle size={12} className="text-destructive shrink-0" />
                      <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLOR[d.severity] || ""}`}>{SEVERITY_LABELS[d.severity] || d.severity}</Badge>
                      <span className="font-semibold text-foreground">{d.position}</span>
                      <span className="text-muted-foreground flex-1 min-w-0 truncate">— {normalizeDamageText(d.description || "") || "—"}</span>
                      {d.photoUrl && <SignedImage value={d.photoUrl} alt="" className="w-12 h-12 rounded object-contain border border-border/30 bg-muted/30 ml-auto" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {missingAcc.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Acessórios faltantes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingAcc.map((k) => (
                      <Badge key={k} variant="outline" className="text-xs bg-destructive/5 text-destructive border-destructive/30 px-2 py-0.5">
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

      {/* ===== COMPARAÇÃO FOTOGRÁFICA ===== */}
      {isComplete && (checkin?.exterior_photos as any[])?.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <SectionHeader icon={Camera} title="Comparação Fotográfica" kicker="Registro Visual Lado a Lado" />
            <div className="space-y-4">
              {(checkin.exterior_photos as any[])
                .filter((p: any) => !p.position?.startsWith("__"))
                .map((ciPhoto: any) => {
                  const coPhoto = (checkout?.exterior_photos as any[])?.find((p: any) => p.position === ciPhoto.position);
                  return (
                    <div key={ciPhoto.id || ciPhoto.position} className="rounded-lg border border-border/30 overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 border-b border-border/30">
                        <p className="text-xs font-semibold text-foreground">{ciPhoto.position}</p>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border/30">
                        <div className="p-2">
                          <p className="text-[9px] uppercase tracking-wider text-primary font-medium mb-1.5">Entrega</p>
                          <SignedImage value={ciPhoto.url} alt="" className="w-full aspect-[4/3] object-contain rounded bg-muted/30" loading="lazy" />
                        </div>
                        <div className="p-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Devolução</p>
                          {coPhoto ? (
                            <SignedImage value={coPhoto.url} alt="" className="w-full aspect-[4/3] object-contain rounded bg-muted/30" loading="lazy" />
                          ) : (
                            <div className="w-full aspect-[4/3] rounded border-2 border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== SINISTROS ===== */}
      {incidents.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <SectionHeader icon={ShieldAlert} title={`Sinistros e Ocorrências (${incidents.length})`} kicker="Eventos Operacionais" />
            <div className="space-y-2">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-3.5 rounded-lg border border-border/40 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{inc.title}</p>
                    <Badge variant="outline" className={SEVERITY_COLOR[inc.severity] || ""}>{SEVERITY_LABELS[inc.severity] || inc.severity}</Badge>
                  </div>
                  {inc.description && <p className="text-xs text-muted-foreground">{inc.description}</p>}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <Calendar size={10} />
                    <span>{fmtDate(inc.incident_date)}</span>
                    <span className="text-border">•</span>
                    <span className="capitalize">{inc.type}</span>
                    <span className="text-border">•</span>
                    <span className="font-semibold text-foreground">{fmtMoney(Number(inc.actual_cost || inc.estimated_cost || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== FINANCEIRO ===== */}
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={DollarSign} title="Resumo Financeiro" kicker="Apuração Final" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Valor da Reserva", value: fmtMoney(Number(booking.total_price || 0)) },
              { label: "Caução", value: fmtMoney(Number(booking.deposit_amount || 0)) },
              { label: "Franquia", value: fmtMoney(Number(booking.franchise_amount || 0)) },
              { label: "Pagamento", value: (booking.payment_status || "—").toUpperCase(), highlight: booking.payment_status === "paid" },
            ].map((kpi) => (
              <div key={kpi.label} className="flex min-h-[82px] flex-col items-center justify-center rounded-lg border border-border/30 bg-muted/20 px-3 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-[1.15]">{kpi.label}</p>
                <p className={`mt-1.5 text-sm font-medium tabular-nums leading-[1.2] ${kpi.highlight ? "text-emerald-700" : "text-foreground"}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {extraCharges.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Cobranças Adicionais Apuradas</p>
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  {extraCharges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-3 bg-background border-b border-border/20 last:border-0">
                      <div>
                        <p className="font-semibold text-foreground">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.reason}</p>
                      </div>
                      <span className="font-medium text-destructive tabular-nums">{fmtMoney(c.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm p-3 bg-destructive/5 border-t border-destructive/20">
                    <span className="font-medium text-foreground">Total a deduzir da caução</span>
                    <span className="font-medium text-destructive text-base tabular-nums">{fmtMoney(totalExtras)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {transactions.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Lançamentos Financeiros</p>
                <div className="space-y-1.5">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs p-2.5 rounded border border-border/30">
                      <div>
                        <p className="font-medium text-foreground">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{fmtDate(t.transaction_date)} • <span className="capitalize">{t.type}</span></p>
                      </div>
                      <span className={`font-medium tabular-nums ${t.type === "income" ? "text-emerald-700" : "text-destructive"}`}>
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

      {/* ===== OBSERVAÇÕES ===== */}
      {(checkin?.notes || checkout?.notes) && (
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            <SectionHeader icon={FileText} title="Observações do Agente" kicker="Notas de Campo" />
            {checkin?.notes && (
              <div className="rounded-lg border-l-2 border-l-primary/60 bg-primary/[0.025] border-y border-r border-border/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-primary font-medium mb-1">Entrega</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{checkin.notes}</p>
              </div>
            )}
            {checkout?.notes && (
              <div className="rounded-lg border-l-2 border-l-foreground/40 bg-muted/30 border-y border-r border-border/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Devolução</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{checkout.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== ASSINATURAS ===== */}
      {isComplete && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <SectionHeader icon={FileSignature} title="Assinaturas das Partes" kicker="Validação Jurídica" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Entrega", data: checkin, accent: "border-l-primary/60" },
                { label: "Devolução", data: checkout, accent: "border-l-foreground/40" },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg border border-border/30 border-l-2 ${s.accent} p-4 space-y-2`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] uppercase text-muted-foreground mb-1">Cliente</p>
                      {s.data?.customer_signature ? (
                        <img src={s.data.customer_signature} alt="" className="w-full h-20 object-contain bg-white rounded border border-border/40" />
                      ) : (
                        <div className="h-20 rounded border-2 border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-muted-foreground mb-1">Agente Sua Marca</p>
                      {s.data?.agent_signature ? (
                        <img src={s.data.agent_signature} alt="" className="w-full h-20 object-contain bg-white rounded border border-border/40" />
                      ) : (
                        <div className="h-20 rounded border-2 border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{fmtName(s.data?.agent_name)} • {fmtDateTime(s.data?.completed_at)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer (screen only — print uses fixed footer) */}
      <div className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border/30 print:hidden">
        Laudo gerado em {fmtDateTime(new Date().toISOString())} • Sua Marca • Documento {reportNumber}
      </div>
      </div>{/* /.laudo-content */}
      </div>{/* /.laudo-print */}
    </>
  );
}

