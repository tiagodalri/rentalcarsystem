import { WizardForm, inputCls, labelCls } from "./types";
import BrandAutocomplete from "./BrandAutocomplete";

const currentYear = new Date().getFullYear();

type Props = {
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
};

export default function StepIdentification({ form, set }: Props) {
  const num = (k: keyof WizardForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set({ [k]: v === "" ? null : Number(v) } as any);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className={labelCls}>Marca *</label>
        <BrandAutocomplete value={form.brand} onChange={(v) => set({ brand: v })} />
      </div>
      <div>
        <label className={labelCls}>Modelo *</label>
        <input className={inputCls} value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="Ex: Corolla" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Versão</label>
        <input className={inputCls} value={form.version} onChange={(e) => set({ version: e.target.value })} placeholder="Ex: XEi 2.0 Flex" />
      </div>
      <div>
        <label className={labelCls}>Ano fabricação</label>
        <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.manufacture_year ?? ""} onChange={num("manufacture_year")} placeholder={String(currentYear)} />
      </div>
      <div>
        <label className={labelCls}>Ano modelo</label>
        <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.model_year ?? ""} onChange={num("model_year")} placeholder={String(currentYear)} />
      </div>
      <div>
        <label className={labelCls}>Placa *</label>
        <input className={`${inputCls} uppercase`} value={form.license_plate} onChange={(e) => set({ license_plate: e.target.value.toUpperCase() })} placeholder="ABC-1D23" />
      </div>
      <div>
        <label className={labelCls}>Cor</label>
        <input className={inputCls} value={form.color} onChange={(e) => set({ color: e.target.value })} placeholder="Ex: Preto" />
      </div>
      <div>
        <label className={labelCls}>Chassi (VIN)</label>
        <input className={`${inputCls} uppercase font-mono text-sm`} maxLength={17} value={form.vin} onChange={(e) => set({ vin: e.target.value.toUpperCase() })} placeholder="17 caracteres" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>IMEI Bouncie (rastreador)</label>
        <input className={`${inputCls} tabular-nums font-mono text-sm`} inputMode="numeric" value={form.bouncie_imei} onChange={(e) => set({ bouncie_imei: e.target.value.replace(/\s/g, "") })} placeholder="Ex: 351234567890123" />
        <p className="text-[11px] text-muted-foreground mt-1">Encontre em Users & Devices no portal Bouncie.</p>
      </div>
    </div>
  );
}
