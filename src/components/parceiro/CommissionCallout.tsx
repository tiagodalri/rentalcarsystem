import { TrendingUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  commissionType: "percent" | "fixed" | null | undefined;
  commissionValue: number | null | undefined;
  bookingTotal: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

export default function CommissionCallout({
  commissionType,
  commissionValue,
  bookingTotal,
  size = "md",
  className,
  label = "Você ganha",
}: Props) {
  const hasRule = !!commissionType && commissionValue != null;

  const amount = hasRule
    ? commissionType === "percent"
      ? (bookingTotal * Number(commissionValue)) / 100
      : Number(commissionValue)
    : 0;

  const sublabel = hasRule
    ? commissionType === "percent"
      ? `${Number(commissionValue)}% da reserva`
      : "Comissão fixa por reserva"
    : "";

  const padding = size === "sm" ? "px-3 py-2" : size === "lg" ? "px-5 py-4" : "px-4 py-3";
  const bigTxt = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  if (!hasRule) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-muted/30 flex items-center gap-2",
          padding,
          className,
        )}
      >
        <Info size={iconSize} className="text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Comissão
          </p>
          <p className="text-sm text-foreground/80">A definir pela locadora</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-emerald-600/5 flex items-center gap-3",
        padding,
        className,
      )}
    >
      <div className="shrink-0 h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <TrendingUp size={iconSize} className="text-emerald-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold">
          {label}
        </p>
        <p className={cn("font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-tight", bigTxt)}>
          US$ {amount.toFixed(2)}
        </p>
        {sublabel && (
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
