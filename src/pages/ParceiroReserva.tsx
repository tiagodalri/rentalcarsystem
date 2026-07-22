import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ArrowLeft, Loader2, Building2, Calendar as CalIcon, CheckCircle2, User } from "lucide-react";
import CommissionCallout from "@/components/parceiro/CommissionCallout";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getCoverImage } from "@/data/vehicleImages";
import { parseDateOnly } from "@/lib/dateOnly";
import { fmtUSD, fmtUSDCompact } from "@/lib/partnerFormat";


type NavState = {
  vehicle: {
    id: string;
    name: string;
    category: string;
    daily_price_usd: number;
    image_url: string | null;
    photos?: unknown;
    locadora_id: string;
    locadora_name: string;
    commission_type: "percent" | "fixed" | null;
    commission_value: number | null;
  };
  pickup_date: string;
  return_date: string;
};

function pickPhoto(v: NavState["vehicle"]): string {
  const arr = Array.isArray(v.photos) ? (v.photos as unknown[]) : [];
  const first = arr.find((p) => typeof p === "string" && p) as string | undefined
    || (typeof (arr[0] as { url?: string })?.url === "string" ? (arr[0] as { url: string }).url : undefined);
  return (typeof v.image_url === "string" && v.image_url) ? v.image_url : (first || getCoverImage(v.name));
}

export default function ParceiroReserva() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as NavState | null;

  const [authorizing, setAuthorizing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ number: string; id: string; total: number; commission: number | null } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [driverAge, setDriverAge] = useState<string>("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "partner")
        .maybeSingle();
      if (!role) { navigate("/parceiro/login", { replace: true }); return; }
      setAuthorizing(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/parceiro/login", { replace: true });
  };

  const days = useMemo(() => {
    if (!state) return 1;
    const p = parseDateOnly(state.pickup_date).getTime();
    const r = parseDateOnly(state.return_date).getTime();
    return Math.max(1, Math.ceil((r - p) / 86400000));
  }, [state]);

  const total = useMemo(() => {
    if (!state) return 0;
    return Math.round(state.vehicle.daily_price_usd * days);
  }, [state, days]);

  // commission rendering handled by CommissionCallout

  const handleSubmit = async () => {
    if (!state) return;
    if (name.trim().length < 2) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do viajante.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-create-booking", {
        body: {
          vehicle_id: state.vehicle.id,
          pickup_date: state.pickup_date,
          return_date: state.return_date,
          pickup_time: pickupTime || null,
          return_time: returnTime || null,
          pickup_location: pickupLocation || null,
          return_location: returnLocation || null,
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          customer_phone: phone.trim() || null,
          driver_age: driverAge ? Number(driverAge) : null,
          notes: notes.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao criar reserva");
      setConfirmed({
        id: data.booking_id,
        number: data.booking_number,
        total: Number(data.total_price),
        commission: data.commission_amount != null ? Number(data.commission_amount) : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao criar reserva", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-muted-foreground text-center">Nenhum veículo selecionado. Volte à busca para escolher um.</p>
        <Button onClick={() => navigate("/parceiro/buscar")} variant="outline">Ir para busca</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo className="h-7 shrink-0" />
          <span className="hidden sm:inline text-xs uppercase tracking-[0.22em] text-muted-foreground items-center gap-1.5">
            <Handshake size={13} className="text-primary inline mr-1" /> Parceiro
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <button
          onClick={() => navigate("/parceiro/buscar")}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Voltar à busca
        </button>

        {confirmed ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-10 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-semibold">Reserva confirmada</h1>
            <p className="text-sm text-muted-foreground">
              A locadora <span className="text-foreground font-medium">{state.vehicle.locadora_name}</span> já recebeu essa reserva.
            </p>
            <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-card px-6 py-4">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Número da reserva</span>
              <span className="text-xl font-semibold tabular-nums">{confirmed.number}</span>
            </div>

            {confirmed.commission != null && confirmed.commission > 0 && (
              <div className="max-w-sm mx-auto">
                <CommissionCallout
                  commissionType={state.vehicle.commission_type}
                  commissionValue={state.vehicle.commission_value}
                  bookingTotal={confirmed.total}
                  size="lg"
                  label="Comissão desta reserva"
                />
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Total: <span className="text-foreground font-medium tabular-nums">US$ {confirmed.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button onClick={() => navigate("/parceiro/buscar")} variant="outline">Nova busca</Button>
              <Button onClick={() => navigate("/parceiro/comissoes")} className="gold-gradient text-primary-foreground">Ver minhas comissões</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Form */}
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Dados do viajante</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  A locadora receberá esses dados assim que a reserva for confirmada.
                </p>
              </div>

              <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6 space-y-4">
                <Field label="Nome completo do viajante *">
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Ana Beatriz Silva" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="E-mail">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="viajante@email.com" />
                  </Field>
                  <Field label="Telefone">
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+1 555-000-0000" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Idade do condutor">
                    <input type="number" min={18} max={99} value={driverAge} onChange={(e) => setDriverAge(e.target.value)} className={inputCls} placeholder="Ex.: 32" />
                  </Field>
                  <Field label="Hora de retirada">
                    <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Hora de devolução">
                    <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Local de retirada">
                    <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className={inputCls} placeholder="Ex.: MCO Airport" />
                  </Field>
                  <Field label="Local de devolução">
                    <input value={returnLocation} onChange={(e) => setReturnLocation(e.target.value)} className={inputCls} placeholder="Ex.: MCO Airport" />
                  </Field>
                </div>
                <Field label="Observações">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="Detalhes adicionais para a locadora" />
                </Field>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full gold-gradient text-primary-foreground font-bold uppercase tracking-widest py-3 rounded-xl hover:opacity-90"
              >
                {submitting ? (<><Loader2 size={16} className="animate-spin mr-2" /> Confirmando...</>) : "Confirmar reserva"}
              </Button>
            </div>

            {/* Summary */}
            <aside className="lg:sticky lg:top-4 h-fit rounded-2xl border border-border/40 bg-card overflow-hidden">
              <div className="aspect-[16/10] bg-muted/40 overflow-hidden">
                <img src={pickPhoto(state.vehicle)} alt={state.vehicle.name} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{state.vehicle.category}</p>
                  <h2 className="text-base font-semibold text-foreground">{state.vehicle.name}</h2>
                </div>

                <div className="rounded-lg border border-border/40 bg-background/50 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Building2 size={12} className="text-primary" />
                    <span className="font-medium">Locadora:</span>
                    <span className="text-muted-foreground truncate">{state.vehicle.locadora_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <CalIcon size={12} className="text-primary" />
                    <span className="text-muted-foreground">
                      {format(parseDateOnly(state.pickup_date), "dd MMM", { locale: pt })}
                      {" → "}
                      {format(parseDateOnly(state.return_date), "dd MMM yyyy", { locale: pt })}
                      {" · "}
                      {days} {days === 1 ? "diária" : "diárias"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <User size={12} className="text-primary" />
                    <span className="text-muted-foreground">
                      Diária: <span className="tabular-nums">US$ {state.vehicle.daily_price_usd.toFixed(2)}</span>
                    </span>
                  </div>
                </div>

                <CommissionCallout
                  commissionType={state.vehicle.commission_type}
                  commissionValue={state.vehicle.commission_value}
                  bookingTotal={total}
                  size="md"
                  label="Você vai ganhar"
                />

                <div className="pt-3 border-t border-border/30 flex items-end justify-between">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total estimado</span>
                  <span className="text-lg font-semibold text-primary tabular-nums">US$ {total}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  Valor final calculado e travado no servidor no momento da confirmação.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-lg border border-border/60 bg-background/50 text-sm text-foreground outline-none focus:border-primary/40 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      {children}
    </label>
  );
}
