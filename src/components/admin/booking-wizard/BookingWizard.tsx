import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Car, Users, MapPin, Shield, Wrench, CreditCard, FileCheck2, Pencil, Search, Fuel, Cog, Palette, Calendar, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerCombobox } from "@/components/admin/CustomerCombobox";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { BookingDateField } from "@/components/admin/BookingDateField";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";
import { useVehiclesDB } from "@/hooks/useVehiclesDB";
import { AiCapturePanel } from "./AiCapturePanel";
import {
  WIZARD_STEPS,
  initialWizardForm,
  type StepId,
  type WizardFormState,
  type AiExtractResult,
} from "./types";
import { createBooking, checkAvailability } from "@/lib/createBooking";

interface Props {
  aiMode: boolean;
  onDone: () => void;
  onCancel: () => void;
}

const DRAFT_KEY = "booking-wizard-v1";

const PAYMENT_METHODS = [
  "Cartão de Crédito",
  "Cartão de Débito",
  "Stripe",
  "PIX",
  "Dinheiro",
  "Transferência Bancária",
  "Zelle",
  "PayPal",
  "Outro",
];

const STEP_ICONS: Record<StepId, any> = {
  customer: Users,
  vehicle: Car,
  pickup: MapPin,
  return: MapPin,
  deposit: Shield,
  extras: Wrench,
  payment: CreditCard,
  review: FileCheck2,
};

const AI_BADGE = (
  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
    <Sparkles size={9} /> IA
  </span>
);

export function BookingWizard({ aiMode, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<"capture" | "wizard">(aiMode ? "capture" : "wizard");
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<WizardFormState>(initialWizardForm);
  const [aiKeys, setAiKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { vehicles } = useVehiclesDB();

  // Persist drafts (form only, not customer object)
  useFormDraft(DRAFT_KEY, form, (next) => setForm(next), phase === "wizard");

  const set = <K extends keyof WizardFormState>(k: K, v: WizardFormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (aiKeys.has(k as string)) {
      setAiKeys((prev) => {
        const n = new Set(prev);
        n.delete(k as string);
        return n;
      });
    }
  };

  const matchVehicleByName = (name?: string | null): string => {
    if (!name) return "";
    const n = name.toLowerCase().trim();
    const exact = vehicles.find((v) => v.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = vehicles.find((v) => v.name.toLowerCase().includes(n) || n.includes(v.name.toLowerCase()));
    return partial?.id || "";
  };

  const handleAiExtracted = (d: AiExtractResult) => {
    const next = { ...form };
    const keys = new Set<string>();
    const apply = <K extends keyof WizardFormState>(k: K, v: any) => {
      if (v !== null && v !== undefined && v !== "") {
        (next as any)[k] = typeof initialWizardForm[k] === "string" ? String(v) : v;
        keys.add(k as string);
      }
    };
    apply("customer_name", d.customer_name);
    apply("customer_email", d.customer_email);
    apply("customer_phone", d.customer_phone);
    apply("pickup_date", d.pickup_date);
    apply("return_date", d.return_date);
    if (d.pickup_time) { next.pickup_time = d.pickup_time; keys.add("pickup_time"); }
    if (d.return_time) { next.return_time = d.return_time; keys.add("return_time"); }
    apply("pickup_location", d.pickup_location);
    apply("return_location", d.return_location);
    if (d.total_price != null) { next.total_price = String(d.total_price); keys.add("total_price"); }
    if (d.currency === "BRL" || d.currency === "USD") { next.currency = d.currency; keys.add("currency"); }
    if (d.payment_method) { next.payment_method = d.payment_method; keys.add("payment_method"); }
    if (d.deposit_amount != null) { next.deposit_amount = String(d.deposit_amount); keys.add("deposit_amount"); }
    if (d.franchise_amount != null) { next.franchise_amount = String(d.franchise_amount); keys.add("franchise_amount"); }
    if (d.notes) { next.notes = d.notes; keys.add("notes"); }
    const vid = matchVehicleByName(d.vehicle_name);
    if (vid) { next.vehicle_id = vid; keys.add("vehicle_id"); }
    setForm(next);
    setAiKeys(keys);
    setPhase("wizard");
    setStepIdx(0);
  };

  // Auto-suggest total + deposit/franchise from chosen vehicle
  useEffect(() => {
    if (!form.vehicle_id) return;
    const veh = vehicles.find((v) => v.id === form.vehicle_id);
    if (!veh) return;
    setForm((p) => {
      const next = { ...p };
      if (p.pickup_date && p.return_date && (!p.total_price || Number(p.total_price) === 0)) {
        const days = Math.max(1, Math.round((new Date(p.return_date).getTime() - new Date(p.pickup_date).getTime()) / 86400000));
        next.total_price = (Number(veh.daily_price_usd) * days).toFixed(2);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vehicle_id, form.pickup_date, form.return_date]);

  const days = useMemo(() => {
    if (!form.pickup_date || !form.return_date) return 0;
    return Math.max(0, Math.round((new Date(form.return_date).getTime() - new Date(form.pickup_date).getTime()) / 86400000));
  }, [form.pickup_date, form.return_date]);

  // Validation per step
  const stepValid = (id: StepId): boolean => {
    switch (id) {
      case "customer": return !!form.customer_name.trim();
      case "vehicle": return !!form.vehicle_id;
      case "pickup": return !!form.pickup_date && !!form.pickup_time;
      case "return": return !!form.return_date && !!form.return_time && days > 0;
      case "deposit": return true;
      case "extras": return true;
      case "payment": return !!form.total_price && Number(form.total_price) > 0;
      case "review": return true;
    }
  };

  const currentStep = WIZARD_STEPS[stepIdx];
  const canAdvance = stepValid(currentStep.id);
  const isLast = stepIdx === WIZARD_STEPS.length - 1;

  const goNext = () => { if (canAdvance && !isLast) setStepIdx((i) => i + 1); };
  const goBack = () => { if (stepIdx > 0) setStepIdx((i) => i - 1); else onCancel(); };
  const jumpTo = (id: StepId) => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === id);
    if (idx >= 0) setStepIdx(idx);
  };

  const handleSubmit = async () => {
    if (!form.customer_name || !form.vehicle_id || !form.pickup_date || !form.return_date) {
      toast({ title: "Há campos obrigatórios faltando", variant: "destructive" });
      return;
    }
    setSaving(true);
    const available = await checkAvailability(form.vehicle_id, form.pickup_date, form.return_date);
    if (!available) {
      setSaving(false);
      toast({ title: "Veículo indisponível", description: "Já reservado nesse período.", variant: "destructive" });
      return;
    }
    const { error } = await createBooking({
      customer_id: form.customer?.id || null,
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      vehicle_id: form.vehicle_id,
      pickup_date: form.pickup_date,
      pickup_time: form.pickup_time,
      return_date: form.return_date,
      return_time: form.return_time,
      pickup_location: form.pickup_location || null,
      return_location: form.return_location || null,
      plan_id: form.plan_id,
      total_price: form.total_price ? Number(form.total_price) : null,
      status: "confirmed",
      notes: form.notes || null,
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : 0,
      deposit_refund_days: form.deposit_refund_days ? Number(form.deposit_refund_days) : null,
      franchise_amount: form.franchise_amount ? Number(form.franchise_amount) : 0,
      payment_method: form.payment_method,
      payment_status: form.payment_status,
      currency: form.currency,
      driver_age: form.driver_age ? Number(form.driver_age) : null,
      extra_driver: form.extra_driver,
      addons: {
        extras: {
          child_seat: form.child_seat,
          toll_tag: form.toll_tag,
          premium_insurance: form.premium_insurance,
        },
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar reserva", description: error.message, variant: "destructive" });
      return;
    }
    clearFormDraft(DRAFT_KEY);
    toast({ title: "Reserva criada com sucesso" });
    onDone();
  };

  // ---------- Render ----------
  if (phase === "capture") {
    return (
      <div className="space-y-4">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Escolher outro método
        </button>
        <AiCapturePanel onExtracted={handleAiExtracted} onSkip={() => setPhase("wizard")} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Cancelar
        </button>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Etapa {stepIdx + 1} de {WIZARD_STEPS.length}
        </div>
      </div>

      {/* Stepper */}
      <Stepper stepIdx={stepIdx} onJump={(idx) => setStepIdx(idx)} stepValid={stepValid} />

      {/* Step content */}
      <div className="max-w-3xl mx-auto">
        <StepHeader id={currentStep.id} />
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6">
          {currentStep.id === "customer" && (
            <CustomerStep form={form} set={set} aiKeys={aiKeys} />
          )}
          {currentStep.id === "vehicle" && (
            <VehicleStep form={form} set={set} aiKeys={aiKeys} />
          )}
          {currentStep.id === "pickup" && (
            <PickupStep form={form} set={set} aiKeys={aiKeys} />
          )}
          {currentStep.id === "return" && (
            <ReturnStep form={form} set={set} aiKeys={aiKeys} days={days} />
          )}
          {currentStep.id === "deposit" && (
            <DepositStep form={form} set={set} aiKeys={aiKeys} />
          )}
          {currentStep.id === "extras" && (
            <ExtrasStep form={form} set={set} aiKeys={aiKeys} />
          )}
          {currentStep.id === "payment" && (
            <PaymentStep form={form} set={set} aiKeys={aiKeys} days={days} />
          )}
          {currentStep.id === "review" && (
            <ReviewStep form={form} days={days} jumpTo={jumpTo} aiKeys={aiKeys} />
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/50 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <Button variant="outline" onClick={goBack} disabled={saving} className="h-11 rounded-xl">
            <ArrowLeft size={14} className="mr-1.5" /> {stepIdx === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit} disabled={saving} className="h-11 px-6 rounded-xl">
              {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
              Confirmar e criar reserva
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canAdvance} className="h-11 px-6 rounded-xl">
              Avançar <ArrowRight size={14} className="ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function Stepper({ stepIdx, onJump, stepValid }: { stepIdx: number; onJump: (i: number) => void; stepValid: (id: StepId) => boolean }) {
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="flex items-center gap-2 min-w-max">
        {WIZARD_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.id];
          const completed = i < stepIdx && stepValid(s.id);
          const active = i === stepIdx;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= stepIdx && onJump(i)}
                disabled={i > stepIdx}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : completed
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {completed ? <Check size={11} /> : <Icon size={11} />}
                <span className="whitespace-nowrap">{s.title}</span>
              </button>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`w-4 h-px ${i < stepIdx ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepHeader({ id }: { id: StepId }) {
  const Icon = STEP_ICONS[id];
  const titles: Record<StepId, { t: string; s: string }> = {
    customer: { t: "Cliente", s: "Busque um cliente existente ou cadastre um novo." },
    vehicle: { t: "Veículo", s: "Selecione o carro alugado." },
    pickup: { t: "Retirada", s: "Quando e onde o cliente retira o veículo." },
    return: { t: "Devolução", s: "Quando e onde o veículo será devolvido." },
    deposit: { t: "Caução & Franquia", s: "Confirme os valores e o prazo de devolução do caução." },
    extras: { t: "Opcionais", s: "Plano, motorista adicional e itens extras." },
    payment: { t: "Pagamento", s: "Valor total, forma e status do pagamento." },
    review: { t: "Revisão", s: "Confira tudo antes de confirmar." },
  };
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{titles[id].t}</h2>
        <p className="text-xs text-muted-foreground">{titles[id].s}</p>
      </div>
    </div>
  );
}

type StepProps = {
  form: WizardFormState;
  set: <K extends keyof WizardFormState>(k: K, v: WizardFormState[K]) => void;
  aiKeys: Set<string>;
};

function FieldLabel({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
      {children}
      {ai && AI_BADGE}
    </Label>
  );
}

function CustomerStep({ form, set, aiKeys }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Buscar cliente existente</FieldLabel>
        <CustomerCombobox
          selected={form.customer}
          onSelect={(c) => {
            set("customer", c);
            if (c) {
              set("customer_name", c.full_name);
              set("customer_email", c.email || "");
              set("customer_phone", c.phone || "");
            }
          }}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <FieldLabel ai={aiKeys.has("customer_name")}>Nome completo *</FieldLabel>
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="João da Silva" className="h-11" />
        </div>
        <div>
          <FieldLabel ai={aiKeys.has("customer_email")}>E-mail</FieldLabel>
          <Input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} placeholder="email@exemplo.com" className="h-11" />
        </div>
        <div>
          <FieldLabel ai={aiKeys.has("customer_phone")}>Telefone</FieldLabel>
          <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="+55 (11) 99999-9999" className="h-11" />
        </div>
      </div>
    </div>
  );
}

function VehicleStep({ form, set, aiKeys }: StepProps) {
  const { vehicles } = useVehiclesDB();
  const [filter, setFilter] = useState<string>("all");
  const categories = useMemo(() => Array.from(new Set(vehicles.map((v) => v.category))).filter(Boolean), [vehicles]);
  const filtered = filter === "all" ? vehicles : vehicles.filter((v) => v.category === filter);
  const aiSuggested = aiKeys.has("vehicle_id") ? form.vehicle_id : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${filter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${filter === c ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((v) => {
          const selected = form.vehicle_id === v.id;
          const isAi = aiSuggested === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => set("vehicle_id", v.id)}
              className={`text-left rounded-xl border p-3 flex gap-3 transition-all ${
                selected ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border/50 bg-card hover:border-primary/40"
              }`}
            >
              <div className="h-16 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                {v.image_url ? (
                  <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{v.name}</p>
                  {isAi && AI_BADGE}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{v.category}</p>
                <p className="text-sm font-semibold tabular-nums mt-1">${Number(v.daily_price_usd).toFixed(0)}<span className="text-[10px] text-muted-foreground font-normal">/dia</span></p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickupStep({ form, set, aiKeys }: StepProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel ai={aiKeys.has("pickup_date")}>Data de retirada *</FieldLabel>
          <BookingDateField value={form.pickup_date} onChange={(v) => set("pickup_date", v)} />
        </div>
        <div>
          <FieldLabel ai={aiKeys.has("pickup_time")}>Horário</FieldLabel>
          <Input type="time" value={form.pickup_time} onChange={(e) => set("pickup_time", e.target.value)} className="h-11" />
        </div>
      </div>
      <div>
        <FieldLabel ai={aiKeys.has("pickup_location")}>Local de retirada</FieldLabel>
        <AddressAutocomplete value={form.pickup_location} onChange={(v) => set("pickup_location", v)} placeholder="Aeroporto, hotel, endereço..." />
      </div>
    </div>
  );
}

function ReturnStep({ form, set, aiKeys, days }: StepProps & { days: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel ai={aiKeys.has("return_date")}>Data de devolução *</FieldLabel>
          <BookingDateField value={form.return_date} onChange={(v) => set("return_date", v)} />
        </div>
        <div>
          <FieldLabel ai={aiKeys.has("return_time")}>Horário</FieldLabel>
          <Input type="time" value={form.return_time} onChange={(e) => set("return_time", e.target.value)} className="h-11" />
        </div>
      </div>
      <div>
        <FieldLabel ai={aiKeys.has("return_location")}>Local de devolução</FieldLabel>
        <AddressAutocomplete value={form.return_location} onChange={(v) => set("return_location", v)} placeholder="Aeroporto, hotel, endereço..." />
      </div>
      {days > 0 && (
        <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm">
          Duração da locação: <span className="font-semibold tabular-nums">{days} {days === 1 ? "dia" : "dias"}</span>
        </div>
      )}
    </div>
  );
}

function DepositStep({ form, set, aiKeys }: StepProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <FieldLabel ai={aiKeys.has("deposit_amount")}>Caução (USD)</FieldLabel>
        <Input type="number" min="0" value={form.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} placeholder="500" className="h-11 tabular-nums" />
      </div>
      <div>
        <FieldLabel ai={aiKeys.has("franchise_amount")}>Franquia (USD)</FieldLabel>
        <Input type="number" min="0" value={form.franchise_amount} onChange={(e) => set("franchise_amount", e.target.value)} placeholder="2000" className="h-11 tabular-nums" />
      </div>
      <div>
        <FieldLabel>Prazo p/ devolver o caução (dias)</FieldLabel>
        <Input type="number" min="0" value={form.deposit_refund_days} onChange={(e) => set("deposit_refund_days", e.target.value)} placeholder="30" className="h-11 tabular-nums" />
      </div>
    </div>
  );
}

function ExtrasStep({ form, set }: StepProps) {
  const ToggleRow = ({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Plano</FieldLabel>
          <Select value={form.plan_id} onValueChange={(v) => set("plan_id", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="essencial">Essencial — $0</SelectItem>
              <SelectItem value="conforto">Conforto — $29</SelectItem>
              <SelectItem value="premium">Premium — $49</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Idade do motorista</FieldLabel>
          <Input type="number" min="18" max="99" value={form.driver_age} onChange={(e) => set("driver_age", e.target.value)} placeholder="30" className="h-11 tabular-nums" />
        </div>
      </div>

      <div className="space-y-2">
        <ToggleRow label="Motorista adicional" value={form.extra_driver} onChange={(v) => set("extra_driver", v)} />
        <ToggleRow label="Cadeirinha infantil" value={form.child_seat} onChange={(v) => set("child_seat", v)} />
        <ToggleRow label="Toll Tag (pedágio)" value={form.toll_tag} onChange={(v) => set("toll_tag", v)} />
        <ToggleRow label="Seguro Premium" value={form.premium_insurance} onChange={(v) => set("premium_insurance", v)} />
      </div>
    </div>
  );
}

function PaymentStep({ form, set, aiKeys, days }: StepProps & { days: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <FieldLabel>Moeda</FieldLabel>
          <Select value={form.currency} onValueChange={(v) => set("currency", v as "USD" | "BRL")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="BRL">BRL (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel ai={aiKeys.has("total_price")}>Valor total *</FieldLabel>
          <Input type="number" min="0" step="0.01" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} placeholder="0.00" className="h-11 tabular-nums text-lg" />
          {days > 0 && form.total_price && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Equivale a <span className="tabular-nums">${(Number(form.total_price) / days).toFixed(2)}</span>/dia × {days} dia{days > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel ai={aiKeys.has("payment_method")}>Forma de pagamento</FieldLabel>
          <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Status do pagamento</FieldLabel>
          <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v as "pending" | "paid")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel ai={aiKeys.has("notes")}>Observações</FieldLabel>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Voo, observações especiais, etc." rows={3} className="resize-none" />
      </div>
    </div>
  );
}

function ReviewStep({ form, days, jumpTo, aiKeys }: { form: WizardFormState; days: number; jumpTo: (id: StepId) => void; aiKeys: Set<string> }) {
  const { vehicles } = useVehiclesDB();
  const vehicle = vehicles.find((v) => v.id === form.vehicle_id);

  const Row = ({ label, value, aiKey }: { label: string; value: React.ReactNode; aiKey?: string }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {label}
        {aiKey && aiKeys.has(aiKey) && AI_BADGE}
      </span>
      <span className="text-sm font-medium text-right tabular-nums">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );

  const Block = ({ title, target, children }: { title: string; target: StepId; children: React.ReactNode }) => (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-primary">{title}</h3>
        <button type="button" onClick={() => jumpTo(target)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Pencil size={11} /> Editar
        </button>
      </div>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Confira os dados abaixo. Clique em <span className="font-medium text-foreground">Editar</span> para corrigir qualquer bloco antes de finalizar.
      </p>

      <Block title="Cliente" target="customer">
        <Row label="Nome" value={form.customer_name} aiKey="customer_name" />
        <Row label="E-mail" value={form.customer_email} aiKey="customer_email" />
        <Row label="Telefone" value={form.customer_phone} aiKey="customer_phone" />
      </Block>

      <Block title="Veículo" target="vehicle">
        <Row label="Modelo" value={vehicle?.name} aiKey="vehicle_id" />
        <Row label="Categoria" value={vehicle?.category} />
        <Row label="Diária" value={vehicle ? `$${Number(vehicle.daily_price_usd).toFixed(2)}` : ""} />
      </Block>

      <Block title="Retirada e devolução" target="pickup">
        <Row label="Retirada" value={`${form.pickup_date || "—"} ${form.pickup_time}`} aiKey="pickup_date" />
        <Row label="Local retirada" value={form.pickup_location} aiKey="pickup_location" />
        <Row label="Devolução" value={`${form.return_date || "—"} ${form.return_time}`} aiKey="return_date" />
        <Row label="Local devolução" value={form.return_location} aiKey="return_location" />
        <Row label="Duração" value={`${days} ${days === 1 ? "dia" : "dias"}`} />
      </Block>

      <Block title="Caução & Franquia" target="deposit">
        <Row label="Caução" value={form.deposit_amount ? `$${form.deposit_amount}` : ""} aiKey="deposit_amount" />
        <Row label="Franquia" value={form.franchise_amount ? `$${form.franchise_amount}` : ""} aiKey="franchise_amount" />
        <Row label="Prazo devolução" value={form.deposit_refund_days ? `${form.deposit_refund_days} dias` : ""} />
      </Block>

      <Block title="Opcionais" target="extras">
        <Row label="Plano" value={form.plan_id} />
        <Row label="Idade do motorista" value={form.driver_age} />
        <Row label="Motorista adicional" value={form.extra_driver ? "Sim" : "Não"} />
        <Row label="Cadeirinha" value={form.child_seat ? "Sim" : "Não"} />
        <Row label="Toll Tag" value={form.toll_tag ? "Sim" : "Não"} />
        <Row label="Seguro Premium" value={form.premium_insurance ? "Sim" : "Não"} />
      </Block>

      <Block title="Pagamento" target="payment">
        <Row label="Total" value={form.total_price ? `${form.currency === "USD" ? "$" : "R$"} ${Number(form.total_price).toFixed(2)}` : ""} aiKey="total_price" />
        <Row label="Forma" value={form.payment_method} aiKey="payment_method" />
        <Row label="Status" value={form.payment_status === "paid" ? "Pago" : "Pendente"} />
        <Row label="Observações" value={form.notes} aiKey="notes" />
      </Block>

      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        Ao confirmar, a reserva será criada como <span className="font-semibold text-foreground">Confirmada</span>, com os selos
        <span className="font-semibold text-foreground"> Contrato pendente</span> e
        {form.payment_status === "pending" ? <span className="font-semibold text-foreground"> Pagamento pendente</span> : <span className="font-semibold text-foreground"> Pagamento concluído</span>}.
        Esses selos dão baixa automaticamente quando o contrato é assinado no Clicksign e o pagamento é confirmado.
      </div>
    </div>
  );
}
