import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Car as CarIcon, Wrench, DollarSign, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";

const FLEET_DRAFT_KEY = "new-vehicle";
const currentYear = new Date().getFullYear();
const CATEGORIES = ["Economy", "Compact", "Midsize", "Fullsize", "SUV", "Premium SUV", "Luxury", "Sports", "Minivan", "Pickup", "Convertible"];

const emptyVehicle = {
  name: "", brand: "", model: "", version: "",
  manufacture_year: null as number | null, model_year: null as number | null,
  vin: "",
  license_plate: "", category: "Economy", daily_price_usd: null as number | null,
  passengers: 5, bags: 2, transmission: "Automatic", fuel: "Gasoline",
  status: "available",
  color: "", purchase_price: null as number | null,
  initial_odometer: null as number | null, current_odometer: null as number | null,
  acquired_date: null as string | null,
  bouncie_imei: "",

};

export default function AdminVehicleNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({ ...emptyVehicle });
  const [saving, setSaving] = useState(false);

  useFormDraft(FLEET_DRAFT_KEY, form, (v) => setForm((p: any) => ({ ...p, ...v })), true);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const numChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set(k, v === "" ? null : Number(v));
  };

  const back = () => navigate("/admin/fleet");

  const save = async () => {
    const brand = (form.brand || "").trim();
    const model = (form.model || "").trim();
    const version = (form.version || "").trim();
    const autoName = [brand, model, version].filter(Boolean).join(" ").trim();
    const name = (form.name || "").trim() || autoName;
    const plate = (form.license_plate || "").trim();

    if (!brand || !model) return toast({ title: "Marca e Modelo obrigatórios", variant: "destructive" });
    if (!name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (plate.length < 3) return toast({ title: "Placa obrigatória", description: "Informe ao menos 3 caracteres.", variant: "destructive" });

    setSaving(true);
    const payload = {
      name, brand, model, version: version || null,
      manufacture_year: form.manufacture_year ?? null,
      model_year: form.model_year ?? null,
      vin: (form.vin || "").trim().toUpperCase() || null,
      license_plate: plate.toUpperCase(),
      category: form.category || "Economy",
      daily_price_usd: form.daily_price_usd ?? 0,
      passengers: form.passengers || 5,
      bags: form.bags || 2,
      transmission: form.transmission || "Automatic",
      fuel: form.fuel || "Gasoline",
      year: form.model_year || null,
      status: form.status || "available",
      features: [],
      color: form.color || null,
      purchase_price: form.purchase_price ?? 0,
      initial_odometer: form.initial_odometer ?? 0,
      current_odometer: form.current_odometer ?? 0,
      acquired_date: form.acquired_date || null,
      bouncie_imei: (form.bouncie_imei || "").trim() || null,
      bouncie_vin: (form.bouncie_vin || "").trim().toUpperCase() || null,
    };

    const { data, error } = await supabase.from("vehicles").insert(payload).select("id").single();
    setSaving(false);

    if (error || !data) {
      toast({ title: "Erro ao criar veículo", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Veículo criado", description: "Agora adicione fotos e detalhes adicionais." });
    clearFormDraft(FLEET_DRAFT_KEY);
    navigate(`/admin/fleet/${data.id}?tab=photos`);
  };

  const inputCls = "w-full h-11 px-3 rounded-lg border border-border/60 bg-background text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";
  const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

  const Section = ({ icon: Icon, title, children }: any) => (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={15} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft size={14} /> Voltar para Frota
      </button>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Novo veículo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre o veículo com identificação, especificações e dados comerciais. Fotos e galeria são adicionadas no próximo passo.
        </p>
      </header>

      <div className="space-y-5">
        <Section icon={CarIcon} title="Identificação">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Marca *</label>
              <input className={inputCls} value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="Ex: Toyota" />
            </div>
            <div>
              <label className={labelCls}>Modelo *</label>
              <input className={inputCls} value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} placeholder="Ex: Corolla" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Versão</label>
              <input className={inputCls} value={form.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="Ex: XEi 2.0 Flex" />
            </div>
            <div>
              <label className={labelCls}>Ano fabricação</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.manufacture_year ?? ""} onChange={numChange("manufacture_year")} placeholder={String(currentYear)} />
            </div>
            <div>
              <label className={labelCls}>Ano modelo</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.model_year ?? ""} onChange={numChange("model_year")} placeholder={String(currentYear)} />
            </div>
            <div>
              <label className={labelCls}>Placa *</label>
              <input className={`${inputCls} uppercase`} value={form.license_plate ?? ""} onChange={(e) => set("license_plate", e.target.value.toUpperCase())} placeholder="ABC-1D23" />
            </div>
            <div>
              <label className={labelCls}>Cor</label>
              <input className={inputCls} value={form.color ?? ""} onChange={(e) => set("color", e.target.value)} placeholder="Ex: Preto" />
            </div>
            <div>
              <label className={labelCls}>Chassi (VIN)</label>
              <input className={`${inputCls} uppercase font-mono text-sm`} maxLength={17} value={form.vin ?? ""} onChange={(e) => set("vin", e.target.value.toUpperCase())} placeholder="17 caracteres" />
            </div>
            <div>
              <label className={labelCls}>Renavam</label>
              <input className={`${inputCls} tabular-nums`} inputMode="numeric" value={form.renavam ?? ""} onChange={(e) => set("renavam", e.target.value.replace(/\D/g, ""))} placeholder="11 dígitos" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>IMEI Bouncie (rastreador)</label>
              <input className={`${inputCls} tabular-nums font-mono text-sm`} inputMode="numeric" value={form.bouncie_imei ?? ""} onChange={(e) => set("bouncie_imei", e.target.value.replace(/\s/g, ""))} placeholder="Ex: 351234567890123" />
              <p className="text-[11px] text-muted-foreground mt-1">Número do rastreador Bouncie — encontrado em Users & Devices no portal.</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>VIN Bouncie</label>
              <input className={`${inputCls} uppercase font-mono text-sm`} maxLength={17} value={form.bouncie_vin ?? ""} onChange={(e) => set("bouncie_vin", e.target.value.toUpperCase())} placeholder="Opcional — VIN do dispositivo Bouncie" />
            </div>
          </div>
        </Section>

        <Section icon={Wrench} title="Especificações">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Categoria</label>
              <select className={inputCls} value={form.category || "Economy"} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Passageiros</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.passengers ?? ""} onChange={numChange("passengers")} />
            </div>
            <div>
              <label className={labelCls}>Malas</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.bags ?? ""} onChange={numChange("bags")} />
            </div>
            <div>
              <label className={labelCls}>Transmissão</label>
              <select className={inputCls} value={form.transmission || "Automatic"} onChange={(e) => set("transmission", e.target.value)}>
                <option value="Automatic">Automático</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Combustível</label>
              <select className={inputCls} value={form.fuel || "Gasoline"} onChange={(e) => set("fuel", e.target.value)}>
                <option value="Gasoline">Gasolina</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Elétrico</option>
                <option value="Hybrid">Híbrido</option>
              </select>
            </div>
          </div>
        </Section>

        <Section icon={DollarSign} title="Comercial & Financeiro">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Diária (USD)</label>
              <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.daily_price_usd ?? ""} onChange={numChange("daily_price_usd")} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status || "available"} onChange={(e) => set("status", e.target.value)}>
                <option value="available">Disponível</option>
                <option value="rented">Alugado</option>
                <option value="maintenance">Manutenção</option>
                <option value="unavailable">Indisponível</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Valor de compra (USD)</label>
              <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.purchase_price ?? ""} onChange={numChange("purchase_price")} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Data de aquisição</label>
              <input type="date" className={inputCls} value={form.acquired_date ?? ""} onChange={(e) => set("acquired_date", e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Odômetro inicial (mi)</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.initial_odometer ?? ""} onChange={numChange("initial_odometer")} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Odômetro atual (mi)</label>
              <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.current_odometer ?? ""} onChange={numChange("current_odometer")} placeholder="0" />
            </div>
          </div>
        </Section>

        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-5 flex items-start gap-3">
          <ImagePlus size={18} className="text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-foreground">Fotos e galeria</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Após salvar, você será levado direto para a aba de fotos do veículo para adicionar a galeria.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-2 px-4 sm:px-6 py-3">
          <button
            onClick={back}
            disabled={saving}
            className="h-11 px-4 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="h-11 px-5 rounded-xl gold-gradient text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Adicionar veículo
          </button>
        </div>
      </div>
    </div>
  );
}
