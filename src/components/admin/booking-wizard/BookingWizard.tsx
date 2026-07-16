import { useEffect, useMemo, useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Car, Users, MapPin, Shield, Wrench, CreditCard, FileCheck2, Pencil, Search, Fuel, Cog, Palette, Calendar, Hash, Plus, Trash2 } from "lucide-react";
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
  DEFAULT_ADDON_PRESETS,
  isCountableAddon,
  type StepId,
  type WizardFormState,
  type AiExtractResult,
  type AddonItem,
  type AddonPricingMode,
} from "./types";

import { createBooking, checkAvailability } from "@/lib/createBooking";
import { getCoverImage, hasCoverImage } from "@/data/vehicleImages";

interface Props {
  aiMode: boolean;
  onDone: () => void;
  onCancel: () => void;
}

const DRAFT_KEY = "booking-wizard-v1";
const DRAFT_STORAGE_KEY = `zeus:draft:${DRAFT_KEY}`;

const PAYMENT_METHODS = [
  "Câmbio Real",
  "Cartão de Crédito",
  "Cartão de Débito",
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
  schedule: MapPin,
  deposit: Shield,
  extras: Wrench,
  payment: CreditCard,
  review: FileCheck2,
};


const AI_BADGE = (
  <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
    <Sparkles size={9} /> IA
  </span>
);

type ValidationIssue = {
  stepId: StepId;
  label: string;
  field: keyof WizardFormState;
};

const isWizardFormMeaningfullyEmpty = (draft: WizardFormState): boolean => {
  const meaningfulText = [
    draft.customer_name,
    draft.customer_email,
    draft.customer_phone,
    draft.vehicle_id,
    draft.daily_price_override,
    draft.pickup_date,
    draft.pickup_location,
    draft.pickup_terminal,
    draft.pickup_notes,
    draft.return_date,
    draft.return_location,
    draft.return_terminal,
    draft.return_notes,
    draft.deposit_amount,
    draft.franchise_amount,
    draft.total_price,
    draft.paid_date,
    draft.payment_due_date,
    draft.deposit_paid_amount,
    draft.deposit_paid_date,
    draft.notes,
  ];

  return meaningfulText.every((value) => !String(value ?? "").trim());
};

const normalizeWizardForm = (draft: WizardFormState): WizardFormState => {
  const paymentStatus = ["pending", "paid", "partial"].includes(draft.payment_status)
    ? draft.payment_status
    : initialWizardForm.payment_status;

  return {
    ...initialWizardForm,
    ...draft,
    customer: draft.customer && typeof draft.customer === "object" ? draft.customer : null,
    pickup_location_type: draft.pickup_location_type === "custom" ? "custom" : "airport",
    return_location_type: draft.return_location_type === "custom" ? "custom" : "airport",
    addons_list: Array.isArray(draft.addons_list) ? draft.addons_list : initialWizardForm.addons_list,
    currency: draft.currency === "BRL" ? "BRL" : "USD",
    payment_status: paymentStatus,
  };
};

const getStepIssues = (form: WizardFormState, days: number, stepId: StepId): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  switch (stepId) {
    case "customer":
      if (!form.customer_name.trim()) issues.push({ stepId, label: "nome do cliente", field: "customer_name" });
      break;
    case "vehicle":
      if (!form.vehicle_id) issues.push({ stepId, label: "veículo", field: "vehicle_id" });
      break;
    case "schedule":
      if (!form.pickup_date) issues.push({ stepId, label: "data de retirada", field: "pickup_date" });
      if (!form.pickup_time) issues.push({ stepId, label: "horário de retirada", field: "pickup_time" });
      if (!form.return_date) issues.push({ stepId, label: "data de devolução", field: "return_date" });
      if (!form.return_time) issues.push({ stepId, label: "horário de devolução", field: "return_time" });
      if (form.pickup_date && form.return_date && days <= 0) {
        issues.push({ stepId, label: "período de locação válido (devolução depois da retirada)", field: "return_date" });
      }
      break;
    case "payment":
      if (!form.total_price || Number(form.total_price) <= 0) issues.push({ stepId, label: "valor total", field: "total_price" });
      break;
    case "deposit":
    case "extras":
    case "review":
      break;
  }

  return issues;
};

const formatIssues = (issues: ValidationIssue[]): string => {
  const unique = Array.from(new Set(issues.map((issue) => issue.label)));
  return unique.slice(0, 4).join(", ") + (unique.length > 4 ? "..." : "");
};


export function BookingWizard({ aiMode, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<"capture" | "wizard">(aiMode ? "capture" : "wizard");
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<WizardFormState>(initialWizardForm);
  const [aiKeys, setAiKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
  const [pendingAdvance, setPendingAdvance] = useState(false);


  const { vehicles } = useVehiclesDB({ includeSensitive: true });

  // Persistência defensiva: defaults como horário/pagamento não podem impedir a restauração do rascunho.
  useFormDraft(
    DRAFT_KEY,
    form,
    (next) => setForm(normalizeWizardForm(next)),
    phase === "wizard",
    { isEmpty: isWizardFormMeaningfullyEmpty, debounceMs: 150 },
  );

  // Persist current step index so user resumes exactly where they left off
  const STEP_KEY = `${DRAFT_KEY}-step`;
  useEffect(() => {
    if (phase !== "wizard") return;
    if (!isWizardFormMeaningfullyEmpty(form)) return;
    try {
      const draftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      const parsedDraft = draftRaw ? JSON.parse(draftRaw) : null;
      const draft = parsedDraft && typeof parsedDraft === "object" ? normalizeWizardForm(parsedDraft as WizardFormState) : null;
      if (!draft || isWizardFormMeaningfullyEmpty(draft)) {
        localStorage.removeItem(STEP_KEY);
        return;
      }

      const raw = localStorage.getItem(STEP_KEY);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 0 && n < WIZARD_STEPS.length) {
          const restoredDays = draft.pickup_date && draft.return_date
            ? Math.max(0, Math.round((parseDateOnly(draft.return_date).getTime() - parseDateOnly(draft.pickup_date).getTime()) / 86400000))
            : 0;
          const firstInvalidIdx = WIZARD_STEPS
            .slice(0, n)
            .findIndex((step) => getStepIssues(draft, restoredDays, step.id).length > 0);
          setStepIdx(firstInvalidIdx >= 0 ? firstInvalidIdx : n);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "wizard") return;
    try { localStorage.setItem(STEP_KEY, String(stepIdx)); } catch { /* ignore */ }
  }, [stepIdx, phase, STEP_KEY]);

  // Last-saved indicator
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (phase !== "wizard") return;
    const t = setTimeout(() => setLastSavedAt(new Date()), 500);
    return () => clearTimeout(t);
  }, [form, phase]);


  const set = <K extends keyof WizardFormState>(k: K, v: WizardFormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (aiKeys.has(k as string)) {
      setAiKeys((prev) => {
        const n = new Set(prev);
        n.delete(k as string);
        return n;
      });
    }
    if (errorFields.has(k as string)) {
      setErrorFields((prev) => {
        const n = new Set(prev);
        n.delete(k as string);
        return n;
      });
    }
  };

  const flagErrors = (issues: ValidationIssue[]) => {
    if (issues.length === 0) return;
    setErrorFields(new Set(issues.map((i) => i.field as string)));
    // Scroll to first invalid field after render
    setTimeout(() => {
      const first = issues[0]?.field;
      if (!first) return;
      const el = document.querySelector(`[data-field="${first}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = el.querySelector("input, textarea, select, button") as HTMLElement | null;
        focusable?.focus();
      }
    }, 60);
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

  // Auto-suggest total from chosen vehicle + override daily price
  useEffect(() => {
    if (!form.vehicle_id) return;
    const veh = vehicles.find((v) => v.id === form.vehicle_id);
    if (!veh) return;
    const daily = Number(form.daily_price_override) || Number(veh.daily_price_usd) || 0;
    setForm((p) => {
      if (!p.pickup_date || !p.return_date) return p;
      const d = Math.max(1, Math.round((parseDateOnly(p.return_date).getTime() - parseDateOnly(p.pickup_date).getTime()) / 86400000));
      const next = { ...p };
      if (!p.total_price || Number(p.total_price) === 0) {
        next.total_price = (daily * d).toFixed(2);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vehicle_id, form.pickup_date, form.return_date, form.daily_price_override]);


  const days = useMemo(() => {
    if (!form.pickup_date || !form.return_date) return 0;
    return Math.max(0, Math.round((parseDateOnly(form.return_date).getTime() - parseDateOnly(form.pickup_date).getTime()) / 86400000));
  }, [form.pickup_date, form.return_date]);

  const stepValid = (id: StepId): boolean => {
    return getStepIssues(form, days, id).length === 0;
  };

  const currentStep = WIZARD_STEPS[stepIdx];
  const canAdvance = stepValid(currentStep.id);
  const isLast = stepIdx === WIZARD_STEPS.length - 1;

  // Resolve race: when VehicleStep dispara "Confirmar e avançar", esperamos o state
  // commitar para validar com o vehicle_id já presente.
  useEffect(() => {
    if (!pendingAdvance) return;
    if (currentStep.id !== "vehicle") {
      setPendingAdvance(false);
      return;
    }
    if (stepValid("vehicle") && !isLast) {
      setPendingAdvance(false);
      setStepIdx((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAdvance, form.vehicle_id, currentStep.id]);

  const goNext = () => {
    const issues = getStepIssues(form, days, currentStep.id);
    if (issues.length === 0) {
      if (!isLast) setStepIdx((i) => i + 1);
      return;
    }
    flagErrors(issues);
    toast({
      title: "Complete esta etapa antes de avançar",
      description: `Falta preencher: ${formatIssues(issues)}.`,
      variant: "destructive",
    });
  };
  const goBack = () => { if (stepIdx > 0) setStepIdx((i) => i - 1); else onCancel(); };
  const handleStepJump = (targetIdx: number) => {
    if (targetIdx <= stepIdx) {
      setStepIdx(targetIdx);
      return;
    }

    const firstInvalidIdx = WIZARD_STEPS
      .slice(0, targetIdx)
      .findIndex((step) => getStepIssues(form, days, step.id).length > 0);

    if (firstInvalidIdx >= 0) {
      const step = WIZARD_STEPS[firstInvalidIdx];
      const issues = getStepIssues(form, days, step.id);
      setStepIdx(firstInvalidIdx);
      flagErrors(issues);
      toast({
        title: "Existe uma etapa incompleta",
        description: `Falta preencher: ${formatIssues(issues)}.`,
        variant: "destructive",
      });
      return;
    }

    setStepIdx(targetIdx);
  };
  const jumpTo = (id: StepId) => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === id);
    if (idx >= 0) setStepIdx(idx);
  };

  const handleSubmit = async () => {
    const issues = WIZARD_STEPS.flatMap((step) => getStepIssues(form, days, step.id));
    if (issues.length > 0) {
      const firstInvalidIdx = WIZARD_STEPS.findIndex((step) => getStepIssues(form, days, step.id).length > 0);
      if (firstInvalidIdx >= 0) setStepIdx(firstInvalidIdx);
      flagErrors(issues);
      toast({
        title: "Reserva incompleta. nada foi apagado",
        description: `Te levamos para a etapa que falta. Preencha: ${formatIssues(issues)}.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const available = await checkAvailability(form.vehicle_id, form.pickup_date, form.return_date);
    if (!available) {
      setSaving(false);
      toast({ title: "Veículo indisponível", description: "Já reservado nesse período.", variant: "destructive" });
      return;
    }
    const { data: created, error } = await createBooking({
      customer_id: form.customer?.id || null,
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      vehicle_id: form.vehicle_id,
      pickup_date: form.pickup_date,
      pickup_time: form.pickup_time,
      return_date: form.return_date,
      return_time: form.return_time,
      pickup_location: form.pickup_location
        ? form.pickup_location + (form.pickup_location_type === "airport" && form.pickup_terminal ? `. ${form.pickup_terminal}` : "")
        : null,
      return_location: form.return_location
        ? form.return_location + (form.return_location_type === "airport" && form.return_terminal ? `. ${form.return_terminal}` : "")
        : null,

      plan_id: "unico",
      total_price: form.total_price ? Number(form.total_price) : null,
      status: "confirmed",
      notes: form.notes || null,
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : 0,
      deposit_refund_days: form.deposit_refund_days ? Number(form.deposit_refund_days) : null,
      franchise_amount: form.franchise_amount ? Number(form.franchise_amount) : 0,
      payment_method: form.payment_method,
      payment_status: form.payment_status,
      currency: form.currency,
      driver_age: null,
      extra_driver: form.addons_list.some((a) => /motorista adicional/i.test(a.name)),
      addons: {
        items: form.addons_list.map((a) => ({
          name: a.name,
          price: Number(a.price) || 0,
          mode: a.mode,
          quantity: isCountableAddon(a.name) ? Math.max(Number(a.quantity) || 1, 1) : 1,
        })),
        payment_schedule: {
          status: form.payment_status,
          paid_date: form.paid_date || null,
          due_date: form.payment_due_date || null,
          deposit_paid_amount: form.deposit_paid_amount ? Number(form.deposit_paid_amount) : null,
          deposit_paid_date: form.deposit_paid_date || null,
          remaining_amount:
            form.payment_status === "partial" && form.total_price
              ? Math.max(Number(form.total_price) - (Number(form.deposit_paid_amount) || 0), 0)
              : null,
        },
      },

    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar reserva", description: error.message, variant: "destructive" });
      return;
    }

    // Dispara e-mail de confirmação (não bloqueia o fluxo).
    if (created?.id) {
      try {
        const { sendZeusEmail } = await import("@/lib/emails/sendZeusEmail");
        const veh = vehicles.find((v) => v.id === form.vehicle_id);
        const vehicleLabel = veh?.name || "";
        const vehiclePlate = (veh as any)?.license_plate || (veh as any)?.plate || "";
        const currencySym = form.currency === "USD" ? "USD " : (form.currency || "") + " ";
        const fmtMoney = (n: number | null | undefined) =>
          n == null ? "" : `${currencySym}${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const paymentStatusLabel: Record<string, string> = {
          paid: "Pago",
          pending: "Pendente",
          partial: "Parcial",
          refunded: "Reembolsado",
        };
        sendZeusEmail({
          templateName: "booking-confirmed",
          idempotencyKey: `booking-confirmed:${created.id}`,
          templateData: {
            bookingNumber: created.booking_number || "",
            customerName: form.customer_name,
            vehicleName: vehicleLabel,
            vehiclePlate: vehiclePlate,
            pickupDate: form.pickup_date,
            pickupTime: form.pickup_time,
            pickupLocation: form.pickup_location || "",
            returnDate: form.return_date,
            returnTime: form.return_time,
            returnLocation: form.return_location || "",
            totalPrice: fmtMoney(Number(form.total_price)),
            paymentStatus: paymentStatusLabel[form.payment_status] || form.payment_status,
            bookingUrl: `${window.location.origin}/admin/bookings/${created.id}`,
          },
        });
      } catch (e) { console.error("[zeus-email] booking-confirmed dispatch failed", e); }
    }
    clearFormDraft(DRAFT_KEY);
    try { localStorage.removeItem(STEP_KEY); } catch { /* ignore */ }

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
        <div className="flex items-center gap-3">
          {lastSavedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Check size={10} className="text-primary" /> Rascunho salvo
            </span>
          )}
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Etapa {stepIdx + 1} de {WIZARD_STEPS.length}
          </div>
        </div>

      </div>

      {/* Stepper */}
      <Stepper stepIdx={stepIdx} onJump={handleStepJump} stepValid={stepValid} />

      {/* Step content */}
      <div className="max-w-3xl mx-auto">
        <StepHeader id={currentStep.id} />
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6">
          {currentStep.id === "customer" && (
            <CustomerStep form={form} set={set} aiKeys={aiKeys} errorFields={errorFields} />
          )}
          {currentStep.id === "vehicle" && (
            <VehicleStep
              form={form}
              set={set}
              aiKeys={aiKeys}
              errorFields={errorFields}
              onAdvance={() => setPendingAdvance(true)}
            />
          )}
          {currentStep.id === "schedule" && (
            <ScheduleStep form={form} set={set} aiKeys={aiKeys} days={days} errorFields={errorFields} />
          )}

          {currentStep.id === "deposit" && (
            <DepositStep form={form} set={set} aiKeys={aiKeys} errorFields={errorFields} />
          )}
          {currentStep.id === "extras" && (
            <ExtrasStep form={form} set={set} aiKeys={aiKeys} days={days} errorFields={errorFields} />
          )}
          {currentStep.id === "payment" && (
            <PaymentStep form={form} set={set} aiKeys={aiKeys} days={days} errorFields={errorFields} />
          )}
          {currentStep.id === "review" && (
            <ReviewStep form={form} days={days} jumpTo={jumpTo} aiKeys={aiKeys} vehicles={vehicles} />
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
            <Button onClick={goNext} disabled={saving} className="h-11 px-6 rounded-xl">
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
                onClick={() => onJump(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : completed
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
    schedule: { t: "Retirada e devolução", s: "Quando e onde o cliente retira e devolve o veículo." },

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
  errorFields?: Set<string>;
};

const errorClass = (errorFields: Set<string> | undefined, key: string) =>
  errorFields?.has(key) ? "border-destructive ring-2 ring-destructive/30" : "";


function FieldLabel({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
      {children}
      {ai && AI_BADGE}
    </Label>
  );
}

function CustomerStep({ form, set, aiKeys, errorFields }: StepProps) {
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
        <div className="sm:col-span-2" data-field="customer_name">
          <FieldLabel ai={aiKeys.has("customer_name")}>Nome completo *</FieldLabel>
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="João da Silva" className={`h-11 ${errorClass(errorFields, "customer_name")}`} />
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

function VehicleStep({ form, set, aiKeys, errorFields, onAdvance }: StepProps & { onAdvance?: () => void }) {
  const { vehicles } = useVehiclesDB({ includeSensitive: true });
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");

  const aiSuggested = aiKeys.has("vehicle_id") ? form.vehicle_id : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.brand || "").toLowerCase().includes(q) ||
        (v.model || "").toLowerCase().includes(q) ||
        (v.color || "").toLowerCase().includes(q) ||
        (v.license_plate || "").toLowerCase().includes(q) ||
        String(v.year || v.model_year || "").includes(q)
      );
    });
  }, [vehicles, query]);

  const previewVeh = useMemo(() => vehicles.find((v) => v.id === preview) || null, [preview, vehicles]);
  const selectedVeh = useMemo(() => vehicles.find((v) => v.id === form.vehicle_id) || null, [form.vehicle_id, vehicles]);

  const coverOf = (v: any): string | null => {
    if (v?.image_url) return v.image_url;
    const ph = v?.photos;
    if (Array.isArray(ph) && ph.length > 0) {
      const first = typeof ph[0] === "string" ? ph[0] : ph[0]?.url;
      if (first) return first;
    }
    if (v?.name && hasCoverImage(v.name)) return getCoverImage(v.name);
    return null;
  };

  const openPreview = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    setEditPrice(v ? Number(v.daily_price_usd).toFixed(2) : "");
    setPreview(id);
  };

  const confirmSelection = () => {
    if (!previewVeh) return;
    set("vehicle_id", previewVeh.id);
    set("daily_price_override", editPrice);
    setPreview(null);
    // Sinaliza o wizard pra avançar quando o vehicle_id já tiver sido commitado.
    onAdvance?.();
  };



  return (
    <div className="space-y-4">
      {selectedVeh && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="h-12 w-16 rounded-md overflow-hidden bg-muted shrink-0">
            {coverOf(selectedVeh) ? (
              <img src={coverOf(selectedVeh)!} alt={selectedVeh.name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">Selecionado</p>
            <p className="text-sm font-semibold truncate">
              {selectedVeh.name}
              {selectedVeh.year || selectedVeh.model_year ? ` • ${selectedVeh.year || selectedVeh.model_year}` : ""}
              {selectedVeh.color ? ` • ${selectedVeh.color}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openPreview(selectedVeh.id)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Trocar / revisar
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar por nome, modelo, ano, cor ou placa..."
          className="pl-9 h-10 rounded-xl"
        />
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-8">
            Nenhum veículo encontrado.
          </div>
        )}
        {filtered.map((v) => {
          const selected = form.vehicle_id === v.id;
          const isAi = aiSuggested === v.id;
          const cover = coverOf(v);
          const yr = v.year || v.model_year;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => openPreview(v.id)}
              className={`group text-left rounded-xl border overflow-hidden flex flex-col transition-all ${
                selected ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-border/50 bg-card hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                {cover ? (
                  <img src={cover} alt={v.name} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <Car size={28} />
                  </div>
                )}
                {selected && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-primary-foreground">
                    <Check size={10} /> Selecionado
                  </span>
                )}
                {isAi && !selected && (
                  <span className="absolute top-2 left-2">{AI_BADGE}</span>
                )}
                {v.license_plate && (
                  <span className="absolute top-2 right-2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-background/90 text-foreground border border-border/50">
                    {v.license_plate}
                  </span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{v.category}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  {yr && <span className="inline-flex items-center gap-1"><Calendar size={10} />{yr}</span>}
                  {v.color && <span className="inline-flex items-center gap-1"><Palette size={10} />{v.color}</span>}
                </div>
                <p className="text-sm font-semibold tabular-nums pt-1">
                  ${Number(v.daily_price_usd).toFixed(0)}
                  <span className="text-[10px] text-muted-foreground font-normal">/dia</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar veículo</DialogTitle>
          </DialogHeader>
          {previewVeh && (
            <div className="space-y-4">
              <div className="aspect-[16/9] rounded-lg overflow-hidden bg-muted">
                {coverOf(previewVeh) ? (
                  <img src={coverOf(previewVeh)!} alt={previewVeh.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <Car size={40} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium leading-tight">{previewVeh.name}</h3>
                <p className="text-xs text-muted-foreground">{previewVeh.category}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoRow icon={Calendar} label="Ano" value={String(previewVeh.year || previewVeh.model_year || "")} />
                <InfoRow icon={Palette} label="Cor" value={previewVeh.color || ""} />
                <InfoRow icon={Hash} label="Placa" value={previewVeh.license_plate || ""} mono />
                <InfoRow icon={Users} label="Passageiros" value={String(previewVeh.passengers)} />
                <InfoRow icon={Cog} label="Câmbio" value={previewVeh.transmission} />
                <InfoRow icon={Fuel} label="Combustível" value={previewVeh.fuel} />
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">Diária (USD)</p>
                    <p className="text-[10px] text-muted-foreground">
                      Padrão: ${Number(previewVeh.daily_price_usd).toFixed(2)}. ajuste se necessário
                    </p>
                  </div>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="h-10 pl-6 text-right tabular-nums font-medium"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button onClick={confirmSelection}>
              <Check size={14} className="mr-1.5" /> Confirmar e avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-2">
      <Icon size={12} className="text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xs font-semibold truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function ScheduleStep({ form, set, aiKeys, days, errorFields }: StepProps & { days: number }) {
  return (
    <div className="space-y-5">
      {/* Retirada */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <MapPin size={14} />
          </div>
          <h3 className="text-sm font-semibold">Retirada</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div data-field="pickup_date" className={`rounded-lg ${errorFields?.has("pickup_date") ? "ring-2 ring-destructive/40 p-1 -m-1" : ""}`}>
            <FieldLabel ai={aiKeys.has("pickup_date")}>Data *</FieldLabel>
            <BookingDateField value={form.pickup_date} onChange={(v) => set("pickup_date", v)} />
          </div>
          <div data-field="pickup_time">
            <FieldLabel ai={aiKeys.has("pickup_time")}>Horário *</FieldLabel>
            <Input type="time" value={form.pickup_time} onChange={(e) => set("pickup_time", e.target.value)} className={`h-11 ${errorClass(errorFields, "pickup_time")}`} />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>Onde será a retirada?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "airport", label: "Aeroporto" },
              { v: "custom", label: "Endereço personalizado" },
            ] as const).map((opt) => {
              const active = form.pickup_location_type === opt.v;
              return (
                <label
                  key={opt.v}
                  className={`flex items-center gap-2 px-3 h-10 rounded-lg border cursor-pointer transition-colors text-sm ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-card hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => set("pickup_location_type", opt.v)}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {form.pickup_location_type === "airport" ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div>
              <FieldLabel ai={aiKeys.has("pickup_location")}>Aeroporto</FieldLabel>
              <AddressAutocomplete value={form.pickup_location} onChange={(v) => set("pickup_location", v)} placeholder="Ex: Orlando International Airport (MCO)" />
            </div>
            <div>
              <FieldLabel>Terminal</FieldLabel>
              <Input value={form.pickup_terminal} onChange={(e) => set("pickup_terminal", e.target.value)} placeholder="Ex: Terminal A" className="h-11" />
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel ai={aiKeys.has("pickup_location")}>Endereço de retirada</FieldLabel>
            <AddressAutocomplete value={form.pickup_location} onChange={(v) => set("pickup_location", v)} placeholder="Casa, hotel, endereço completo..." />
          </div>
        )}

        <div>
          <FieldLabel>Observações da retirada</FieldLabel>
          <Textarea
            value={form.pickup_notes}
            onChange={(e) => set("pickup_notes", e.target.value)}
            placeholder="Ex: cliente vai pegar com o motorista, levar cadeirinha, etc."
            rows={2}
            className="resize-none"
          />
        </div>
      </div>

      {/* Devolução */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <MapPin size={14} />
          </div>
          <h3 className="text-sm font-semibold">Devolução</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div data-field="return_date" className={`rounded-lg ${errorFields?.has("return_date") ? "ring-2 ring-destructive/40 p-1 -m-1" : ""}`}>
            <FieldLabel ai={aiKeys.has("return_date")}>Data *</FieldLabel>
            <BookingDateField value={form.return_date} onChange={(v) => set("return_date", v)} />
          </div>
          <div data-field="return_time">
            <FieldLabel ai={aiKeys.has("return_time")}>Horário *</FieldLabel>
            <Input type="time" value={form.return_time} onChange={(e) => set("return_time", e.target.value)} className={`h-11 ${errorClass(errorFields, "return_time")}`} />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel>Onde será a devolução?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "airport", label: "Aeroporto" },
              { v: "custom", label: "Endereço personalizado" },
            ] as const).map((opt) => {
              const active = form.return_location_type === opt.v;
              return (
                <label
                  key={opt.v}
                  className={`flex items-center gap-2 px-3 h-10 rounded-lg border cursor-pointer transition-colors text-sm ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-card hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => set("return_location_type", opt.v)}
                    className="h-4 w-4 accent-primary"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {form.return_location_type === "airport" ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div>
              <FieldLabel ai={aiKeys.has("return_location")}>Aeroporto</FieldLabel>
              <AddressAutocomplete value={form.return_location} onChange={(v) => set("return_location", v)} placeholder="Ex: Orlando International Airport (MCO)" />
            </div>
            <div>
              <FieldLabel>Terminal</FieldLabel>
              <Input value={form.return_terminal} onChange={(e) => set("return_terminal", e.target.value)} placeholder="Ex: Terminal B" className="h-11" />
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel ai={aiKeys.has("return_location")}>Endereço de devolução</FieldLabel>
            <AddressAutocomplete value={form.return_location} onChange={(v) => set("return_location", v)} placeholder="Casa, hotel, endereço completo..." />
          </div>
        )}

        <div>
          <FieldLabel>Observações da devolução</FieldLabel>
          <Textarea
            value={form.return_notes}
            onChange={(e) => set("return_notes", e.target.value)}
            placeholder="Ex: deixar com tanque cheio, exigência específica, etc."
            rows={2}
            className="resize-none"
          />
        </div>
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

function ExtrasStep({ form, set, days }: StepProps & { days: number }) {
  const addons = form.addons_list;

  const update = (id: string, patch: Partial<AddonItem>) => {
    set(
      "addons_list",
      addons.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  };

  const remove = (id: string) => {
    set("addons_list", addons.filter((a) => a.id !== id));
  };

  const addNew = (preset?: Omit<AddonItem, "id">) => {
    const item: AddonItem = preset
      ? { ...preset, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
      : {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "",
          price: "0",
          mode: "per_day",
        };
    set("addons_list", [...addons, item]);
  };

  const presetsAvailable = DEFAULT_ADDON_PRESETS.filter(
    (p) => !addons.some((a) => a.name.toLowerCase() === p.name.toLowerCase()),
  );

  const subtotal = addons.reduce((sum, a) => {
    const price = Number(a.price) || 0;
    const qty = isCountableAddon(a.name) ? Math.max(Number(a.quantity) || 1, 1) : 1;
    return sum + (a.mode === "per_day" ? price * Math.max(days, 1) * qty : price * qty);
  }, 0);

  return (
    <div className="space-y-3">
      {addons.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum opcional adicionado. Use os botões abaixo para incluir.
        </div>
      )}

      <div className="space-y-2">
        {addons.map((a) => {
          const price = Number(a.price) || 0;
          const countable = isCountableAddon(a.name);
          const qty = countable ? Math.max(Number(a.quantity) || 1, 1) : 1;
          const lineTotal = a.mode === "per_day" ? price * Math.max(days, 1) * qty : price * qty;
          return (
            <div key={a.id} className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className={countable ? "col-span-12 sm:col-span-4" : "col-span-12 sm:col-span-5"}>
                  <FieldLabel>Nome</FieldLabel>
                  <Input
                    value={a.name}
                    onChange={(e) => update(a.id, { name: e.target.value })}
                    placeholder="Ex: Cadeirinha infantil"
                    className="h-10"
                  />
                </div>
                {countable && (
                  <div className="col-span-4 sm:col-span-2">
                    <FieldLabel>Qtd</FieldLabel>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={qty}
                      onChange={(e) =>
                        update(a.id, { quantity: Math.max(parseInt(e.target.value) || 1, 1) })
                      }
                      className="h-10 tabular-nums"
                    />
                  </div>
                )}
                <div className={countable ? "col-span-4 sm:col-span-2" : "col-span-5 sm:col-span-3"}>
                  <FieldLabel>Preço (USD)</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={a.price}
                    onChange={(e) => update(a.id, { price: e.target.value })}
                    className="h-10 tabular-nums"
                  />
                </div>
                <div className={countable ? "col-span-4 sm:col-span-3" : "col-span-5 sm:col-span-3"}>
                  <FieldLabel>Cobrança</FieldLabel>
                  <Select
                    value={a.mode}
                    onValueChange={(v) => update(a.id, { mode: v as AddonPricingMode })}
                  >
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_day">Por diária</SelectItem>
                      <SelectItem value="total">Valor total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(a.id)}
                    aria-label="Remover opcional"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end text-[11px] text-muted-foreground tabular-nums">
                {a.mode === "per_day"
                  ? `$${price.toFixed(2)} × ${Math.max(days, 1)} ${Math.max(days, 1) === 1 ? "dia" : "dias"}${countable && qty > 1 ? ` × ${qty}` : ""} = `
                  : countable && qty > 1
                    ? `$${price.toFixed(2)} × ${qty} = `
                    : "Total: "}
                <span className="ml-1 font-semibold text-foreground">${lineTotal.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {presetsAvailable.map((p) => (
          <Button
            key={p.name}
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={() => addNew(p)}
          >
            <Plus size={13} className="mr-1" /> {p.name}
          </Button>
        ))}
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-9 text-xs"
          onClick={() => addNew()}
        >
          <Plus size={13} className="mr-1" /> Opcional personalizado
        </Button>
      </div>

      {addons.length > 0 && (
        <div className="flex justify-between items-center rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">Subtotal de opcionais</span>
          <span className="font-semibold text-foreground tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}


function PaymentStep({ form, set, aiKeys, days, errorFields }: StepProps & { days: number }) {
  const total = Number(form.total_price) || 0;
  const deposit = Number(form.deposit_paid_amount) || 0;
  const remaining = Math.max(total - deposit, 0);
  const currencySymbol = form.currency === "USD" ? "$" : "R$";

  const StatusPill = ({
    value,
    label,
    hint,
  }: {
    value: "paid" | "pending" | "partial";
    label: string;
    hint: string;
  }) => {
    const active = form.payment_status === value;
    return (
      <button
        type="button"
        onClick={() => set("payment_status", value)}
        className={`text-left rounded-xl border p-3 transition-all ${
          active
            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
            : "border-border/50 bg-card hover:border-primary/50"
        }`}
      >
        <p className={`text-sm font-semibold ${active ? "text-foreground" : "text-foreground"}`}>{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
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
        <div className="sm:col-span-2" data-field="total_price">
          <FieldLabel ai={aiKeys.has("total_price")}>Valor total *</FieldLabel>
          <Input type="number" min="0" step="0.01" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} placeholder="0.00" className={`h-11 tabular-nums text-lg ${errorClass(errorFields, "total_price")}`} />

          {days > 0 && form.total_price && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Equivale a <span className="tabular-nums">{currencySymbol}{(total / days).toFixed(2)}</span>/dia × {days} dia{days > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

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
        <FieldLabel>Situação do pagamento</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <StatusPill value="paid" label="Pago integralmente" hint="Cliente já pagou tudo" />
          <StatusPill value="partial" label="Sinal + restante" hint="Pagou parte agora, resto depois" />
          <StatusPill value="pending" label="A pagar" hint="Pagamento ainda pendente" />
        </div>
      </div>

      {form.payment_status === "paid" && (
        <div className="rounded-xl border border-border/50 bg-card p-3">
          <FieldLabel>Data do pagamento</FieldLabel>
          <Input type="date" value={form.paid_date} onChange={(e) => set("paid_date", e.target.value)} className="h-11 tabular-nums" />
        </div>
      )}

      {form.payment_status === "pending" && (
        <div className="rounded-xl border border-border/50 bg-card p-3">
          <FieldLabel>Data prevista para pagamento</FieldLabel>
          <Input type="date" value={form.payment_due_date} onChange={(e) => set("payment_due_date", e.target.value)} className="h-11 tabular-nums" />
        </div>
      )}

      {form.payment_status === "partial" && (
        <div className="rounded-xl border border-border/50 bg-card p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Sinal pago ({currencySymbol})</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.deposit_paid_amount}
                onChange={(e) => set("deposit_paid_amount", e.target.value)}
                placeholder="0.00"
                className="h-11 tabular-nums"
              />
            </div>
            <div>
              <FieldLabel>Data do sinal</FieldLabel>
              <Input
                type="date"
                value={form.deposit_paid_date}
                onChange={(e) => set("deposit_paid_date", e.target.value)}
                className="h-11 tabular-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Restante a pagar</FieldLabel>
              <Input
                value={`${currencySymbol} ${remaining.toFixed(2)}`}
                readOnly
                className="h-11 tabular-nums bg-muted/50 font-semibold"
              />
            </div>
            <div>
              <FieldLabel>Data prevista do restante</FieldLabel>
              <Input
                type="date"
                value={form.payment_due_date}
                onChange={(e) => set("payment_due_date", e.target.value)}
                className="h-11 tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <FieldLabel ai={aiKeys.has("notes")}>Observações</FieldLabel>
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Voo, observações especiais, etc." rows={3} className="resize-none" />
      </div>
    </div>
  );
}


function ReviewStep({ form, days, jumpTo, aiKeys, vehicles }: { form: WizardFormState; days: number; jumpTo: (id: StepId) => void; aiKeys: Set<string>; vehicles: any[] }) {
  const vehicle = vehicles.find((v) => v.id === form.vehicle_id);


  const Row = ({ label, value, aiKey }: { label: string; value: React.ReactNode; aiKey?: string }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {label}
        {aiKey && aiKeys.has(aiKey) && AI_BADGE}
      </span>
      <span className="text-sm font-medium text-right tabular-nums">{value || <span className="text-muted-foreground"></span>}</span>
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
        Você preenche os dados seguindo as etapas guiadas.
      </p>

      <Block title="Cliente" target="customer">
        <Row label="Nome" value={form.customer_name} aiKey="customer_name" />
        <Row label="E-mail" value={form.customer_email} aiKey="customer_email" />
        <Row label="Telefone" value={form.customer_phone} aiKey="customer_phone" />
      </Block>

      <Block title="Veículo" target="vehicle">
        <Row label="Modelo" value={vehicle?.name} aiKey="vehicle_id" />
        <Row label="Categoria" value={vehicle?.category} />
        <Row label="Diária" value={vehicle ? `$${(Number(form.daily_price_override) || Number(vehicle.daily_price_usd)).toFixed(2)}` : ""} />
      </Block>

      <Block title="Retirada e devolução" target="schedule">
        <Row label="Retirada" value={`${form.pickup_date || ""} ${form.pickup_time}`} aiKey="pickup_date" />
        <Row label="Local retirada" value={form.pickup_location} aiKey="pickup_location" />
        {form.pickup_notes && <Row label="Obs. retirada" value={form.pickup_notes} />}
        <Row label="Devolução" value={`${form.return_date || ""} ${form.return_time}`} aiKey="return_date" />
        <Row label="Local devolução" value={form.return_location} aiKey="return_location" />
        {form.return_notes && <Row label="Obs. devolução" value={form.return_notes} />}
        <Row label="Duração" value={`${days} ${days === 1 ? "dia" : "dias"}`} />

      </Block>

      <Block title="Caução & Franquia" target="deposit">
        <Row label="Caução" value={form.deposit_amount ? `$${form.deposit_amount}` : ""} aiKey="deposit_amount" />
        <Row label="Franquia" value={form.franchise_amount ? `$${form.franchise_amount}` : ""} aiKey="franchise_amount" />
        <Row label="Prazo devolução" value={form.deposit_refund_days ? `${form.deposit_refund_days} dias` : ""} />
      </Block>

      <Block title="Opcionais" target="extras">
        {form.addons_list.length === 0 ? (
          <Row label="Opcionais" value="Nenhum" />
        ) : (
          form.addons_list.map((a) => {
            const price = Number(a.price) || 0;
            const countable = isCountableAddon(a.name);
            const qty = countable ? Math.max(Number(a.quantity) || 1, 1) : 1;
            const total = a.mode === "per_day" ? price * Math.max(days, 1) * qty : price * qty;
            return (
              <Row
                key={a.id}
                label={`${a.name || "Opcional"}${countable && qty > 1 ? ` ×${qty}` : ""}`}
                value={`$${total.toFixed(2)} (${a.mode === "per_day" ? `$${price.toFixed(2)}/dia` : "valor total"})`}
              />
            );
          })
        )}
      </Block>


      <Block title="Pagamento" target="payment">
        <Row label="Total" value={form.total_price ? `${form.currency === "USD" ? "$" : "R$"} ${Number(form.total_price).toFixed(2)}` : ""} aiKey="total_price" />
        <Row label="Forma" value={form.payment_method} aiKey="payment_method" />
        <Row
          label="Situação"
          value={
            form.payment_status === "paid"
              ? `Pago${form.paid_date ? ` em ${form.paid_date}` : ""}`
              : form.payment_status === "partial"
                ? `Sinal ${form.currency === "USD" ? "$" : "R$"} ${(Number(form.deposit_paid_amount) || 0).toFixed(2)}${form.deposit_paid_date ? ` (${form.deposit_paid_date})` : ""} • restante ${form.currency === "USD" ? "$" : "R$"} ${Math.max((Number(form.total_price) || 0) - (Number(form.deposit_paid_amount) || 0), 0).toFixed(2)}${form.payment_due_date ? ` até ${form.payment_due_date}` : ""}`
                : `Pendente${form.payment_due_date ? `. previsto ${form.payment_due_date}` : ""}`
          }
        />
        <Row label="Observações" value={form.notes} aiKey="notes" />
      </Block>

      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        Ao confirmar, a reserva será criada como <span className="font-semibold text-foreground">Confirmada</span>, com o selo
        {form.payment_status === "paid"
          ? <span className="font-semibold text-foreground"> Pagamento concluído</span>
          : form.payment_status === "partial"
            ? <span className="font-semibold text-foreground"> Sinal recebido. restante pendente</span>
            : <span className="font-semibold text-foreground"> Pagamento pendente</span>}.
        O <span className="font-semibold text-foreground">contrato é opcional</span> nesta fase. pode ser enviado depois pela tela da reserva, sem bloquear entrega ou devolução.
      </div>

    </div>
  );
}
