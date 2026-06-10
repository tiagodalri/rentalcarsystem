import { WizardForm, inputCls, labelCls, CATEGORIES, FEATURE_OPTIONS } from "./types";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

type Props = {
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
};

export default function StepSpecs({ form, set }: Props) {
  const num = (k: keyof WizardForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set({ [k]: v === "" ? null : Number(v) } as any);
  };

  const toggleFeature = (f: string) => {
    const has = form.features.includes(f);
    set({ features: has ? form.features.filter((x) => x !== f) : [...form.features, f] });
  };

  const [adding, setAdding] = useState(false);
  const [newFeat, setNewFeat] = useState("");
  const customFeatures = form.features.filter((f) => !FEATURE_OPTIONS.includes(f as any));

  const commitNew = () => {
    const v = newFeat.trim();
    if (!v) { setAdding(false); setNewFeat(""); return; }
    if (!form.features.some((x) => x.toLowerCase() === v.toLowerCase())) {
      set({ features: [...form.features, v] });
    }
    setNewFeat("");
    setAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Categoria</label>
          <select className={inputCls} value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Passageiros</label>
          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.passengers ?? ""} onChange={num("passengers")} />
        </div>
        <div>
          <label className={labelCls}>Malas</label>
          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.bags ?? ""} onChange={num("bags")} />
        </div>
        <div>
          <label className={labelCls}>Portas</label>
          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.doors ?? ""} onChange={num("doors")} />
        </div>
        <div>
          <label className={labelCls}>Transmissão</label>
          <select className={inputCls} value={form.transmission} onChange={(e) => set({ transmission: e.target.value })}>
            <option value="Automatic">Automático</option>
            <option value="Manual">Manual</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Combustível</label>
          <select className={inputCls} value={form.fuel} onChange={(e) => set({ fuel: e.target.value })}>
            <option value="Gasoline">Gasolina</option>
            <option value="Diesel">Diesel</option>
            <option value="Electric">Elétrico</option>
            <option value="Hybrid">Híbrido</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Motor (tipo)</label>
          <input className={inputCls} value={form.engine_type} onChange={(e) => set({ engine_type: e.target.value })} placeholder="Ex: V6 Turbo" />
        </div>
        <div>
          <label className={labelCls}>Cilindrada</label>
          <input className={inputCls} value={form.engine_size} onChange={(e) => set({ engine_size: e.target.value })} placeholder="Ex: 2.0L" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Comodidades</label>
        <div className="flex flex-wrap gap-2">
          {FEATURE_OPTIONS.map((f) => {
            const active = form.features.includes(f);
            return (
              <button
                type="button"
                key={f}
                onClick={() => toggleFeature(f)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {active && <Check size={11} />}
                {f}
              </button>
            );
          })}

          {customFeatures.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 h-8 rounded-full border border-primary/60 bg-primary/10 text-primary text-xs font-medium"
            >
              <Check size={11} />
              {f}
              <button
                type="button"
                onClick={() => toggleFeature(f)}
                className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-primary/15"
                aria-label={`Remover ${f}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}

          {adding ? (
            <span className="inline-flex items-center gap-1 h-8 rounded-full border border-border bg-background px-2">
              <input
                autoFocus
                value={newFeat}
                onChange={(e) => setNewFeat(e.target.value)}
                onBlur={commitNew}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitNew(); }
                  if (e.key === "Escape") { setNewFeat(""); setAdding(false); }
                }}
                placeholder="Nova comodidade"
                className="bg-transparent outline-none text-xs w-36 placeholder:text-muted-foreground"
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-full border border-dashed border-border/80 bg-background text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border"
              aria-label="Adicionar comodidade"
            >
              <Plus size={12} />
              Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
