import { Car, CheckCircle2, KeyRound, Wrench, Eye, AlertTriangle } from "lucide-react";

type Vehicle = {
  status: string;
  published: boolean;
  insurance_expiry?: string | null;
  registration_expiry?: string | null;
};

type Props = {
  vehicles: Vehicle[];
  onFilter?: (key: "all" | "available" | "rented" | "maintenance" | "published" | "expiring") => void;
  activeKey?: string | null;
};

const today = new Date();
const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

const isExpiringSoon = (v: Vehicle) => {
  const dates = [v.insurance_expiry, v.registration_expiry].filter(Boolean) as string[];
  return dates.some((d) => {
    const dt = new Date(d);
    return dt >= today && dt <= in30;
  });
};

export default function FleetKpiStrip({ vehicles, onFilter, activeKey }: Props) {
  const total = vehicles.length;
  const available = vehicles.filter((v) => v.status === "available").length;
  const rented = vehicles.filter((v) => v.status === "rented").length;
  const maintenance = vehicles.filter((v) => v.status === "maintenance").length;
  const published = vehicles.filter((v) => v.published).length;
  const expiring = vehicles.filter(isExpiringSoon).length;

  const items = [
    { key: "all", label: "Frota total", value: total, Icon: Car, accent: "text-foreground" },
    { key: "available", label: "Disponíveis", value: available, Icon: CheckCircle2, accent: "text-green-600 dark:text-green-500" },
    { key: "rented", label: "Alugados", value: rented, Icon: KeyRound, accent: "text-blue-600 dark:text-blue-400" },
    { key: "maintenance", label: "Manutenção", value: maintenance, Icon: Wrench, accent: "text-yellow-600 dark:text-yellow-500" },
    { key: "published", label: "No site", value: published, Icon: Eye, accent: "text-primary" },
    { key: "expiring", label: "Vencendo (30d)", value: expiring, Icon: AlertTriangle, accent: "text-destructive" },
  ] as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map(({ key, label, value, Icon, accent }) => {
        const active = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => onFilter?.(key as any)}
            className={`text-left rounded-xl border bg-card/40 hover:bg-card/70 transition-colors px-3 py-2.5 ${
              active ? "border-primary/60 ring-1 ring-primary/30" : "border-border/40"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
              <Icon size={13} className={accent} />
            </div>
            <div className={`text-xl font-bold tabular-nums ${accent}`}>{value}</div>
          </button>
        );
      })}
    </div>
  );
}
