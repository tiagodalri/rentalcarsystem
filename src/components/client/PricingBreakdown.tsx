import { Separator } from "@/components/ui/separator";
import { BookingPricing } from "@/data/bookingTypes";
import { useCurrency } from "@/i18n/CurrencyContext";

interface PricingBreakdownProps {
  pricing: BookingPricing;
  dailyRate: number;
  rentalDays: number;
  discountApplied?: string;
}

const PricingBreakdown = ({ pricing, dailyRate, rentalDays, discountApplied }: PricingBreakdownProps) => {
  const { formatPrice } = useCurrency();

  const lines: { label: string; value: number; highlight?: boolean }[] = [
    { label: `${rentalDays} dias × ${formatPrice(dailyRate)}/dia`, value: pricing.base },
  ];

  if (pricing.insurance > 0) lines.push({ label: "Seguro Premium", value: pricing.insurance });
  if (pricing.childSeat && pricing.childSeat > 0) lines.push({ label: "Cadeirinha infantil", value: pricing.childSeat });
  if (pricing.tollTag > 0) lines.push({ label: "TAG pedágio ilimitada", value: pricing.tollTag });
  if (pricing.oneWayFee > 0) lines.push({ label: "Taxa devolução outra cidade", value: pricing.oneWayFee });
  if (pricing.discount < 0) lines.push({ label: discountApplied ? `Desconto ${discountApplied}` : "Desconto", value: pricing.discount, highlight: true });

  return (
    <div className="space-y-2.5">
      {lines.map((line, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{line.label}</span>
          <span className={line.highlight ? "text-green-500 font-medium" : "text-foreground"}>
            {line.value < 0 ? `-${formatPrice(Math.abs(line.value))}` : formatPrice(line.value)}
          </span>
        </div>
      ))}
      <Separator className="my-2 bg-border/30" />
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-foreground uppercase tracking-wider">Total</span>
        <span className="text-2xl font-bold gold-text">{formatPrice(pricing.total)}</span>
      </div>
    </div>
  );
};

export default PricingBreakdown;
