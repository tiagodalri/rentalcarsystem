import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Car as CarIcon, Wrench, DollarSign, ImagePlus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";
import { EMPTY_FORM, WizardForm } from "./types";
import StepIdentification from "./StepIdentification";
import StepSpecs from "./StepSpecs";
import StepCommercial from "./StepCommercial";
import StepDocuments, { PendingDocument } from "./StepDocuments";
import StepPhotosAndPublish, { PendingPhoto } from "./StepPhotosAndPublish";

const DRAFT_KEY = "new-vehicle";

const isVehicleDraftEmpty = (draft: WizardForm) => [
  draft.name,
  draft.brand,
  draft.model,
  draft.version,
  draft.vin,
  draft.license_plate,
  draft.color,
  draft.bouncie_imei,
  draft.e_pass_transponder,
  draft.engine_type,
  draft.engine_size,
  draft.daily_price_usd,
  draft.purchase_price,
  draft.acquired_date,
  draft.initial_odometer,
  draft.current_odometer,
  draft.insurance_policy,
  draft.insurance_expiry,
  draft.registration_expiry,
].every((value) => !String(value ?? "").trim()) && draft.features.length === 0;

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 1, title: "Identificação", Icon: CarIcon },
  { id: 2, title: "Especificações", Icon: Wrench },
  { id: 3, title: "Comercial & Preços", Icon: DollarSign },
  { id: 4, title: "Documentação", Icon: FileText },
  { id: 5, title: "Fotos & Publicação", Icon: ImagePlus },
] as const;

export default function VehicleWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>(1);
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM });
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFormDraft(
    DRAFT_KEY,
    form as unknown as Record<string, any>,
    (v) => setForm((p) => ({ ...p, ...(v as Partial<WizardForm>) })),
    true,
    {
      debounceMs: 150,
      isEmpty: (draft) => isVehicleDraftEmpty(draft as unknown as WizardForm),
    },
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

  const goNext = () => {
    const err = validateStep(step);
    if (err) return toast({ title: "Revise os campos", description: err, variant: "destructive" });
    setStep((s) => (Math.min(5, s + 1) as StepId));
  };

  const goBack = () => {
    if (step === 1) return navigate("/admin/fleet");
    setStep((s) => (Math.max(1, s - 1) as StepId));
  };

  const buildName = () => {
    const composed = [form.brand, form.model, form.version].map((x) => x.trim()).filter(Boolean).join(" ").trim();
    return (form.name?.trim() || composed).trim();
  };

  const finish = async () => {
    const e1 = validateStep(1);
    if (e1) { setStep(1); return toast({ title: "Revise os campos", description: e1, variant: "destructive" }); }
    const e3 = validateStep(3);
    if (e3) { setStep(3); return toast({ title: "Revise os campos", description: e3, variant: "destructive" }); }

    const name = buildName();
    if (!name) return toast({ title: "Nome obrigatório", variant: "destructive" });

    setSaving(true);
    try {
      const payload: any = {
        name,
        brand: form.brand.trim(),
        model: form.model.trim(),
        version: form.version.trim() || null,
        manufacture_year: form.manufacture_year,
        model_year: form.model_year,
        year: form.model_year || form.manufacture_year || null,
        vin: form.vin.trim().toUpperCase() || null,
        license_plate: form.license_plate.trim().toUpperCase(),
        color: form.color || null,
        bouncie_imei: form.bouncie_imei.trim() || null,
        e_pass_transponder: form.e_pass_transponder.trim() || null,
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

      const { data: created, error } = await supabase
        .from("vehicles")
        .insert(payload)
        .select("id")
        .single();
      if (error || !created) throw error || new Error("Falha ao criar veículo");
      const vehicleId = created.id;

      // === DOCUMENTOS ===
      const docsWithFile = documents.filter((d) => d.file && (d.name?.trim() || d.docType !== "other"));
      for (const d of docsWithFile) {
        const file = d.file!;
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${vehicleId}/${d.docType}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("vehicle-documents")
          .upload(path, file, {
            cacheControl: "3600",
            contentType: file.type || undefined,
          });
        if (upErr) {
          toast({ title: "Erro ao enviar documento", description: upErr.message, variant: "destructive" });
          continue;
        }
        const insertRow: any = {
          vehicle_id: vehicleId,
          doc_type: d.docType,
          name: d.name?.trim() || labelForDocType(d.docType),
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          expires_at: d.expiresAt,
          notes: d.notes?.trim() || null,
        };
        await (supabase as any).from("vehicle_documents").insert(insertRow);
      }

      // === FOTOS ===
      const showcase = photos.filter((p) => p.kind === "showcase");
      const registry = photos.filter((p) => p.kind === "registry");
      const showcaseOrdered = coverId
        ? [
            ...showcase.filter((p) => p.id === coverId),
            ...showcase.filter((p) => p.id !== coverId),
          ]
        : showcase;

      const uploadGroup = async (group: PendingPhoto[], folder: "showcase" | "registry") => {
        const urls: string[] = [];
        for (const p of group) {
          const ext = (p.file.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${vehicleId}/${folder}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("vehicle-photos")
            .upload(path, p.file, {
              cacheControl: "3600",
              contentType: p.file.type || undefined,
            });
          if (upErr) {
            toast({ title: "Erro ao enviar foto", description: upErr.message, variant: "destructive" });
            continue;
          }
          const { data: pub } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
          urls.push(pub.publicUrl);
        }
        return urls;
      };

      const [showcaseUrls, registryUrls] = await Promise.all([
        uploadGroup(showcaseOrdered, "showcase"),
        uploadGroup(registry, "registry"),
      ]);

      const updatePayload: any = {};
      if (showcaseUrls.length) {
        updatePayload.photos = showcaseUrls;
        updatePayload.image_url = showcaseUrls[0];
      }
      if (registryUrls.length) updatePayload.registry_photos = registryUrls;
      if (form.published) updatePayload.published = true;
      if (Object.keys(updatePayload).length) {
        await supabase.from("vehicles").update(updatePayload).eq("id", vehicleId);
      }

      clearFormDraft(DRAFT_KEY);
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      toast({ title: "Veículo cadastrado!", description: form.published ? "Publicado no site." : "Salvo como rascunho/oculto." });
      navigate(`/admin/fleet/${vehicleId}`);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
        <h1 className="admin-h1">Novo veículo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha tudo (identificação, especificações, preços, documentação e fotos) e finalize o cadastro de uma vez.
        </p>
      </header>

      <nav className="mb-6">
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {STEPS.map(({ id, title, Icon }) => {
            const isActive = step === id;
            const isDone = step > id;
            return (
              <li key={id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setStep(id as StepId)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : isDone
                      ? "border-border/40 bg-card/40 hover:bg-accent/40"
                      : "border-border/40 bg-card/30 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-7 w-7 rounded-full inline-flex items-center justify-center text-[11px] font-medium ${
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
        {step === 4 && <StepDocuments documents={documents} setDocuments={setDocuments} />}
        {step === 5 && (
          <StepPhotosAndPublish
            form={form}
            set={set}
            photos={photos}
            setPhotos={setPhotos}
            coverId={coverId}
            setCoverId={setCoverId}
          />
        )}
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
            Passo {step} de 5
          </div>

          {step < 5 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="h-11 px-5 rounded-xl gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
            >
              Próximo <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="h-11 px-5 rounded-xl gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Salvando…" : "Concluir cadastro"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function labelForDocType(t: PendingDocument["docType"]): string {
  switch (t) {
    case "purchase_contract": return "Contrato de compra e venda";
    case "vehicle_registration": return "Documento do veículo";
    case "insurance_policy": return "Apólice de seguro";
    case "inspection_report": return "Laudo / Vistoria";
    default: return "Documento";
  }
}
