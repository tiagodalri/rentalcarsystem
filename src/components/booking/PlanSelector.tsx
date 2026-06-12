import { motion } from "framer-motion";
import { Check, X, ShieldCheck, Info } from "lucide-react";
import { useCurrency } from "@/i18n/CurrencyContext";
import { PLANS } from "@/data/rentalPlans";

interface PlanSelectorProps {
  dailyPrice: number;
}

const PlanSelector = ({ dailyPrice }: PlanSelectorProps) => {
  const { formatPrice } = useCurrency();
  const plan = PLANS.unico;

  const included = [
    "Milhagem ilimitada na Flórida",
    "Seguro básico com assistência 24h",
    "Atendimento em português",
  ];

  const notIncluded = [
    "Seguro Premium (Franquia ZERO)",
    "TAG de pedágio (SunPass)",
    "Cadeirinha infantil",
    "Combustível",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header com preço de referência */}
      <div className="flex items-end justify-between gap-3 pb-4 border-b border-border/30">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Diária a partir de</p>
          <p className="text-2xl font-extrabold text-foreground mt-0.5 leading-none">
            {formatPrice(dailyPrice)}
            <span className="text-xs font-medium text-muted-foreground ml-1">/dia</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Caução · Franquia</p>
          <p className="text-xs text-foreground/80 mt-1 tabular-nums">
            {formatPrice(plan.deposit)} <span className="text-muted-foreground">·</span> {formatPrice(plan.franchise)}
          </p>
        </div>
      </div>

      {/* Incluso */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck size={12} className="text-emerald-500" />
          </div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">Incluso na diária</h4>
        </div>
        <ul className="space-y-1.5">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-foreground/80">
              <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Não incluso (vira opcional logo abaixo) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-5 h-5 rounded-full bg-muted/40 flex items-center justify-center">
            <X size={12} className="text-muted-foreground" />
          </div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">Não incluso</h4>
        </div>
        <ul className="space-y-1.5">
          {notIncluded.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
              <X size={13} className="text-muted-foreground/60 mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
          <Info size={11} className="text-primary/70 mt-0.5 shrink-0" />
          Os itens não inclusos podem ser adicionados como opcionais logo abaixo.
        </p>
      </div>
    </motion.div>
  );
};

export default PlanSelector;
