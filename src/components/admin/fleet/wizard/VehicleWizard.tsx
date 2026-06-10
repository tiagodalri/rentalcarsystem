import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Car as CarIcon, Wrench, DollarSign, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";
import { EMPTY_FORM, WizardForm } from "./types";
import StepIdentification from "./StepIdentification";
import StepSpecs from "./StepSpecs";
import StepCommercial from "./StepCommercial";
import StepPhotosAndPublish from "./StepPhotosAndPublish";

const DRAFT_KEY = "new-vehicle";

const STEPS = [
  { id: 1, title: "Identificação", Icon: CarIcon },
  { id: 2, title: "Especificações", Icon: Wrench },
  { id: 3, title: "Comercial & Preços", Icon: DollarSign },
  { id: 4, title: "Fotos & Publicação", Icon: ImagePlus },
] as const;

export default function VehicleWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM });
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-save de rascunho apenas até a criação
  useFormDraft(
    DRAFT_KEY,
    form as unknown as Record<string, any>,
    (v) => setForm((p) => ({ ...p, ...(v as Partial<WizardForm>) })),
    !vehicleId,
  );

  const set = (patch: Partial<WizardForm>) => setForm((p) => ({ ...p, ...patch }));

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.brand.trim() || !form.model.trim()) return "Marca e Modelo são obrigatórios.";
      if (form.license_plate.trim().length < 3) return "Placa obrigatória (mínimo 3 caracteres).";
    }
    if (s === 3) {
      if (form.daily_price_usd == null || form.daily_price_usd <= 0)
        return "Defina o valor da diária para continuar.";
    }
    return null;
  };

  const goNext = async () => {
    const err = validateStep(step);
    if (err) return toast({ title: "Revise os campos", description: err, variant: "destructive" });

    if (step === 3 && !vehicleId) {
      await createVehicle();
      return;
    }
    setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4));
  };

  const goBack = () => {
    if (step === 1) return navigate("/admin/fleet");
    setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4));
  };

  const buildName = () => {
    const composed = [form.brand, form.model, form.version].map((x) => x.trim()).filter(Boolean).join(" ").trim();
    return (form.name?.trim() || composed).trim();
  };

  const createVehicle = async () => {
    const name = buildName();
    if (!name) return toast({ title: "Nome obrigatório", variant: "destructive" });

    setSaving(true);
    const payload = {
      name,
      brand: form.brand.trim(),
      model: form.model.trim(),
      version: form.version.trim() || null,
      manufacture_year: form.manufacture_year,
      model_year: form.model_year,
      year: form.model_year || form.manufacture_year || null,
      vin: form.vin.trim().toUpperCase() || null,
      renavam: form.renavam.trim() || null,
      license_plate: form.license_plate.trim().toUpperCase(),
      color: form.color || null,
      bouncie_imei: form.bouncie_imei.trim() || null,
      category: form.category,
      passengers: form.passengers,
      bags: form.bags,
      doors: form.doors,
      transmission: form.transmission,
      fuel: form.fuel,
      engine_type: form.engine_type || null,
      engine_size: form.engine_size || null,
      features: form.features,
      daily_price_usd: form.daily_price_usd ?? 0,
      default_deposit_amount: form.default_deposit_amount ?? 0,
      default_franchise_amount: form.default_franchise_amount ?? 0,
      status: form.status,
      purchase_price: form.purchase_price ?? 0,
      acquired_date: form.acquired_date,
      initial_odometer: form.initial_odometer ?? 0,
      current_odometer: form.current_odometer ?? 0,
      insurance_policy: form.insurance_policy || null,
      insurance_expiry: form.insurance_expiry,
      registration_expiry: form.registration_expiry,
      published: false,
    };

    const { data, error } = await supabase.from("vehicles").insert(payload as any).select("id").single();
    setSaving(false);
    if (error || !data) {
      toast({ title: "Erro ao criar veículo", description: error?.message, variant: "destructive" });
      return;
    }
    setForm((p) => ({ ...p, name }));
    setVehicleId(data.id);
    clearFormDraft(DRAFT_KEY);
    toast({ title: "Veículo criado!", description: "Agora adicione as fotos e publique no site." });
    setStep(4);
  };

  const finish = () => {
    if (!vehicleId) return navigate("/admin/fleet");
    navigate(`/admin/fleet/${vehicleId}`);
  };

  return (
    <div className="max-w-5xl mx-auto pb-28">
      <button
        onClick={() => navigate("/admin/fleet")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft size={14} /> Voltar para Frota
      </button>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Novo veículo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Em 4 passos: identificação, especificações, preços e publicação com fotos.
        </p>
      </header>

      {/* Stepper */}
      <nav className="mb-6">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map(({ id, title, Icon }) => {
            const isActive = step === id;
            const isDone = step > id || (id < 4 && vehicleId);
            return (
              <li key={id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (id < step) setStep(id as any);
                    else if (id === 4 && vehicleId) setStep(4);
                  }}
                  disabled={id > step && !(id === 4 && !!vehicleId)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : isDone
                      ? "border-border/40 bg-card/40 hover:bg-accent/40"
                      : "border-border/30 bg-card/20 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-7 w-7 rounded-full inline-flex items-center justify-center text-[11px] font-bold ${
                        isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check size={13} /> : id}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Passo {id}</p>
                      <p className="text-xs font-semibold text-foreground truncate inline-flex items-center gap-1">
                        <Icon size={11} /> {title}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="rounded-2xl border border-border/40 bg-card/40 p-5 sm:p-6">
        {step === 1 && <StepIdentification form={form} set={set} />}
        {step === 2 && <StepSpecs form={form} set={set} />}
        {step === 3 && <StepCommercial form={form} set={set} />}
        {step === 4 && vehicleId && <StepPhotosAndPublish vehicleId={vehicleId} form={form} set={set} />}
      </section>

      <div
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 py-3">
          <button
            onClick={goBack}
            disabled={saving}
            className="h-11 px-4 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:bg-accent transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> {step === 1 ? "Cancelar" : "Voltar"}
          </button>

          <div className="text-xs text-muted-foreground hidden sm:block">
            Passo {step} de 4
          </div>

          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="h-11 px-5 rounded-xl gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {step === 3 ? "Criar e ir para fotos" : "Próximo"}
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="h-11 px-5 rounded-xl gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              <Check size={14} /> Concluir cadastro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
