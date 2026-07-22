import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, Calendar, MapPin, Building2, Handshake, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getCoverImage } from "@/data/vehicleImages";
import { parseDateOnly } from "@/lib/dateOnly";
import { fmtUSD } from "@/lib/partnerFormat";

const FN_URL_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type ProposalData = {
  status: "sent" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  customer_name: string;
  message: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time: string | null;
  return_time: string | null;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number;
  vehicle: { name: string; category: string; image_url: string | null; photos: unknown } | null;
  locadora_name: string | null;
  agency_name: string | null;
};

function pickPhoto(v: ProposalData["vehicle"]): string {
  if (!v) return "";
  const arr = Array.isArray(v.photos) ? (v.photos as unknown[]) : [];
  const first = arr.find((p) => typeof p === "string" && p) as string | undefined;
  return v.image_url || first || getCoverImage(v.name);
}

function ErrorScreen({ icon: Icon, title, subtitle, tone = "muted" }: { icon: typeof AlertTriangle; title: string; subtitle: string; tone?: "muted" | "success" | "warn" }) {
  const toneColor = tone === "success" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-muted-foreground";
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center bg-muted/40 ${toneColor}`}>
          <Icon size={30} />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProposalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<{ booking_number: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${FN_URL_BASE}/public-get-proposal?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY },
        });
        const j = await r.json();
        if (!r.ok) { setError(j?.error ?? "unknown"); setLoading(false); return; }
        if (j?.status === "accepted") { setError("accepted"); setLoading(false); return; }
        setData(j);
      } catch {
        setError("network_error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const r = await fetch(`${FN_URL_BASE}/public-accept-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        const msg = j?.error === "not_available"
          ? "As datas ficaram indisponíveis. Entre em contato com sua agência."
          : j?.error === "expired"
          ? "Esta proposta expirou."
          : j?.error === "already_accepted"
          ? "Esta proposta já foi aceita."
          : "Não foi possível confirmar. Tente novamente.";
        toast({ title: "Erro ao confirmar", description: msg, variant: "destructive" });
        return;
      }
      setAccepted({ booking_number: j.booking_number });
    } catch {
      toast({ title: "Erro de rede", description: "Verifique sua conexão.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error === "not_found") return <ErrorScreen icon={XCircle} title="Proposta não encontrada" subtitle="O link pode estar incorreto. Verifique com a agência que enviou." />;
  if (error === "expired") return <ErrorScreen icon={Clock} title="Proposta expirada" subtitle="Este link já passou da data de validade. Solicite uma nova proposta." tone="warn" />;
  if (error === "cancelled") return <ErrorScreen icon={XCircle} title="Proposta cancelada" subtitle="A agência cancelou esta proposta." />;
  if (error === "accepted") return <ErrorScreen icon={CheckCircle2} title="Proposta já aceita" subtitle="Esta reserva já foi confirmada." tone="success" />;
  if (error || !data) return <ErrorScreen icon={AlertTriangle} title="Algo deu errado" subtitle="Não conseguimos carregar sua proposta." />;

  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-semibold">Reserva confirmada!</h1>
          <p className="text-sm text-muted-foreground">
            Sua reserva foi criada com sucesso. Guarde o número abaixo para acompanhar.
          </p>
          <div className="inline-block px-5 py-3 rounded-xl border border-border bg-card">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Número da reserva</p>
            <p className="text-lg font-mono font-semibold tabular-nums">{accepted.booking_number}</p>
          </div>
          <p className="text-xs text-muted-foreground">A agência {data.agency_name ?? "parceira"} entrará em contato com os próximos passos.</p>
        </div>
      </div>
    );
  }

  const pickup = parseDateOnly(data.pickup_date);
  const ret = parseDateOnly(data.return_date);
  const nights = Math.max(1, Math.round((ret.getTime() - pickup.getTime()) / 86400000));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/85 backdrop-blur px-4 sm:px-6 py-4">
        <BrandLogo className="h-7" />
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Intro */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-primary font-semibold">
            <Handshake size={12} /> Proposta exclusiva
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Olá {data.customer_name.split(" ")[0]}, sua proposta chegou.
          </h1>
          {data.agency_name && (
            <p className="text-sm text-muted-foreground">
              Enviada por <span className="font-medium text-foreground">{data.agency_name}</span>
            </p>
          )}
        </div>

        {/* Vehicle card */}
        {data.vehicle && (
          <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
            <div className="aspect-[16/9] bg-muted/40 overflow-hidden">
              <img src={pickPhoto(data.vehicle)} alt={data.vehicle.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">{data.vehicle.category}</p>
                <h2 className="text-xl sm:text-2xl font-semibold">{data.vehicle.name}</h2>
                {data.locadora_name && (
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-1">
                    <Building2 size={12} /> {data.locadora_name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/40">
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Retirada</p>
                    <p className="text-sm">{format(pickup, "dd MMM yyyy", { locale: pt })}{data.pickup_time ? ` · ${data.pickup_time}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Devolução</p>
                    <p className="text-sm">{format(ret, "dd MMM yyyy", { locale: pt })}{data.return_time ? ` · ${data.return_time}` : ""}</p>
                  </div>
                </div>
                {data.pickup_location && (
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Local retirada</p>
                      <p className="text-sm">{data.pickup_location}</p>
                    </div>
                  </div>
                )}
                {data.return_location && (
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Local devolução</p>
                      <p className="text-sm">{data.return_location}</p>
                    </div>
                  </div>
                )}
              </div>

              {data.message && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">Mensagem da agência</p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{data.message}</p>
                </div>
              )}

              <div className="flex items-end justify-between pt-4 border-t border-border/40">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total {nights} {nights === 1 ? "diária" : "diárias"}</p>
                  <p className="text-3xl font-semibold text-primary tabular-nums leading-tight">{fmtUSD(data.total_price)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="sticky bottom-0 sm:static bg-background/95 backdrop-blur sm:bg-transparent p-4 sm:p-0 -mx-4 sm:mx-0 border-t sm:border-t-0 border-border/40">
          <Button
            onClick={accept}
            disabled={accepting}
            className="w-full gold-gradient text-primary-foreground font-bold uppercase tracking-widest h-auto py-4 rounded-xl text-sm gap-2"
          >
            {accepting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Aceitar e confirmar reserva
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            Ao aceitar, sua reserva será confirmada imediatamente. O pagamento é combinado diretamente com a agência.
          </p>
        </div>
      </main>
    </div>
  );
}
