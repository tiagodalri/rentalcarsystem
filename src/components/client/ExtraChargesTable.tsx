import { ExtraCharge } from "@/data/bookingTypes";
import { useCurrency } from "@/i18n/CurrencyContext";

interface ExtraChargesTableProps {
  charges: ExtraCharge[];
}

const ExtraChargesTable = ({ charges }: ExtraChargesTableProps) => {
  const { formatPrice } = useCurrency();

  if (charges.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
        Cobranças extras
      </h4>
      <div className="rounded-lg border border-border/40 overflow-hidden">
        {charges.map((charge, i) => (
          <div
            key={i}
            className={`flex justify-between items-center px-4 py-3 text-sm ${
              i > 0 ? "border-t border-border/30" : ""
            }`}
          >
            <span className="text-muted-foreground">{charge.description}</span>
            <span className="text-amber-400 font-semibold">+{formatPrice(charge.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtraChargesTable;
