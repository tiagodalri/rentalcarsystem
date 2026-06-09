import { motion } from "framer-motion";
import {
  Check, Shield, CircleDollarSign, Baby, Users,
  CalendarX2, CalendarClock, Truck, MessageCircle, ArrowUpCircle,
  MapPin, Zap, ShieldCheck,
} from "lucide-react";
import { useCurrency } from "@/i18n/CurrencyContext";
import { PLANS } from "@/data/rentalPlans";

interface PlanSelectorProps {
  dailyPrice: number;
}

const PlanSelector = ({ dailyPrice }: PlanSelectorProps) => {
  const { formatPrice } = useCurrency();
  const plan = PLANS.unico;

  const features = [
    { label: "Milhagem ilimitada", included: true },
    { label: "Seguro básico + Assistência 24h", included: true },
    { label: "Seguro Premium (Franquia ZERO)", included: false },
    { label: "TAG Pedágio ilimitada (SunPass)", included: false },
    { label: "2º condutor grátis", included: false },
    { label: "Cadeirinha infantil inclusa", included: false },
    { label: "Entrega no hotel/endereço", included: false },
    { label: "Prioridade WhatsApp", included: false },
    { label: "Upgrade grátis (quando disponível)", included: false },
  ];

  return (
    <div className="space-y-3">
      {/* Plan header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center rounded-xl border-2 border-primary/30 bg-primary/5 p-4 pt-5"
      >
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-[0.12em] bg-primary text-primary-foreground flex items-center gap-1 whitespace-nowrap">
          <Zap size={8} />
          PLANO ÚNICO
        </div>
        <p className="text-xs font-bold text-foreground leading-tight">{plan.name}</p>
        <p className="text-sm font-extrabold text-primary mt-1">
          {formatPrice(dailyPrice)}/dia
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Caução: {formatPrice(plan.deposit)} · Franquia: {formatPrice(plan.franchise)}
        </p>
      </motion.div>

      {/* Feature table */}
      <div className="rounded-xl border border-border/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_72px] items-center text-[10px] font-bold px-3 py-2 border-b border-border/20 bg-muted/10">
          <span></span>
          <div className="text-center text-foreground/70 leading-tight">Zeus</div>
        </div>
        {features.map((feat, i) => (
          <div
            key={feat.label}
            className={`grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 ${
              i % 2 === 0 ? "bg-muted/5" : ""
            } ${i !== features.length - 1 ? "border-b border-border/15" : ""}`}
          >
            <span className="text-muted-foreground pr-2">{feat.label}</span>
            <div className="flex justify-center">
              {feat.included ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <span className="text-[10px] text-muted-foreground">Opcional</span>
              )}
            </div>
          </div>
        ))}

        {/* Cancellation row */}
        <div className="grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 border-t border-border/15 bg-muted/5">
          <span className="text-muted-foreground flex items-center gap-1">
            <CalendarX2 size={11} /> Reembolso por Cancelamento
          </span>
          <div className="flex justify-center text-[10px] font-semibold text-foreground leading-tight">
            {plan.cancellation}
          </div>
        </div>

        {/* Reschedule row */}
        <div className="grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 border-t border-border/15">
          <span className="text-muted-foreground flex items-center gap-1">
            <CalendarClock size={11} /> Taxa para remarcação
          </span>
          <div className="text-center text-[10px] font-semibold text-foreground leading-tight">
            {plan.reschedule === "none" ? (
              <span>Não permitida</span>
            ) : (
              <span>{plan.reschedule}</span>
            )}
          </div>
        </div>

        {/* Return fee row */}
        <div className="grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 border-t border-border/15 bg-muted/5">
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin size={11} /> Taxa devolução (outra cidade)
          </span>
          <div className="text-center text-[10px] font-semibold text-foreground leading-tight">
            {plan.returnFee === 0 ? (
              <span className="text-green-500 font-bold">ZERO</span>
            ) : (
              <span>{formatPrice(plan.returnFee)}</span>
            )}
          </div>
        </div>

        {/* Caução row */}
        <div className="grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 border-t border-border/20 bg-muted/10">
          <span className="text-muted-foreground flex items-center gap-1">
            <Shield size={11} /> Caução
          </span>
          <div className="text-center text-[10px] font-bold leading-tight">
            <span className="text-amber-500">{formatPrice(plan.deposit)}</span>
          </div>
        </div>

        {/* Franquia row */}
        <div className="grid grid-cols-[1fr_72px] items-center text-[11px] px-3 py-1.5 border-t border-border/15">
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck size={11} /> Franquia
          </span>
          <div className="text-center text-[10px] font-bold leading-tight">
            <span className="text-amber-500">{formatPrice(plan.franchise)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSelector;
