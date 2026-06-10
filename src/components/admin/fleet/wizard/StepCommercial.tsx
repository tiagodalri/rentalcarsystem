import { WizardForm, inputCls, labelCls } from "./types";

type Props = {
  form: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
};

export default function StepCommercial({ form, set }: Props) {
  const num = (k: keyof WizardForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    set({ [k]: v === "" ? null : Number(v) } as any);
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Preços ao cliente</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Diária (USD) *</label>
            <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.daily_price_usd ?? ""} onChange={num("daily_price_usd")} placeholder="0,00" />
          </div>
          <div>
            <label className={labelCls}>Caução padrão (USD)</label>
            <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.default_deposit_amount ?? ""} onChange={num("default_deposit_amount")} placeholder="500" />
          </div>
          <div>
            <label className={labelCls}>Franquia padrão (USD)</label>
            <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.default_franchise_amount ?? ""} onChange={num("default_franchise_amount")} placeholder="2500" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Caução e franquia são aplicadas como sugestão no momento da reserva e podem ser ajustadas por contrato.
        </p>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Aquisição & odômetro</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status inicial</label>
            <select className={inputCls} value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="available">Disponível</option>
              <option value="maintenance">Manutenção</option>
              <option value="unavailable">Indisponível</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Valor de compra (USD)</label>
            <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={form.purchase_price ?? ""} onChange={num("purchase_price")} placeholder="0,00" />
          </div>
          <div>
            <label className={labelCls}>Data de aquisição</label>
            <input type="date" className={inputCls} value={form.acquired_date ?? ""} onChange={(e) => set({ acquired_date: e.target.value || null })} />
          </div>
          <div className="hidden sm:block" />
          <div>
            <label className={labelCls}>Odômetro inicial (mi)</label>
            <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.initial_odometer ?? ""} onChange={num("initial_odometer")} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Odômetro atual (mi)</label>
            <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={form.current_odometer ?? ""} onChange={num("current_odometer")} placeholder="0" />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Documentação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className={labelCls}>Apólice de seguro</label>
            <input className={inputCls} value={form.insurance_policy} onChange={(e) => set({ insurance_policy: e.target.value })} placeholder="Nº da apólice" />
          </div>
          <div>
            <label className={labelCls}>Vencimento seguro</label>
            <input type="date" className={inputCls} value={form.insurance_expiry ?? ""} onChange={(e) => set({ insurance_expiry: e.target.value || null })} />
          </div>
          <div>
            <label className={labelCls}>Vencimento registration</label>
            <input type="date" className={inputCls} value={form.registration_expiry ?? ""} onChange={(e) => set({ registration_expiry: e.target.value || null })} />
          </div>
        </div>
      </section>
    </div>
  );
}
