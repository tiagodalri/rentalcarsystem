import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useVehicleDetail } from "@/hooks/useVehicleDetail";
import { useVehicleTrips } from "@/hooks/useVehicleTrips";
import { useVehicleZeusContext, type ZeusBooking } from "@/hooks/useVehicleZeusContext";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { formatPersonName } from "@/lib/formatName";
import {
  MapPin, Activity, Shield, Wrench, Car, CalendarClock,
  CalendarRange, DollarSign, AlertTriangle, Heart, ExternalLink, Phone,
} from "lucide-react";

function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
}
function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m} min`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  pending_payment: "Aguardando pagamento",
  confirmed: "Confirmada",
  active: "Ativa",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const COND_COLOR: Record<string, string> = {
  excellent: "text-green-500",
  good: "text-green-500",
  fair: "text-yellow-500",
  poor: "text-red-500",
  critical: "text-red-500",
};
const COND_LABEL: Record<string, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Regular",
  poor: "Ruim",
  critical: "Crítico",
};

export function DetailsTab({ vehicle, vehicleId }: { vehicle: LiveVehicle; vehicleId: string }) {
  const navigate = useNavigate();
  const { data: detail } = useVehicleDetail(vehicleId);
  const { data: trips = [] } = useVehicleTrips(vehicleId, 2);
  const { data: zeus } = useVehicleZeusContext(vehicleId);

  const today = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todays = trips.filter((t) => t.started_at && new Date(t.started_at).toDateString() === todayStr);
    const dist = todays.reduce((s, t) => s + (t.distance_mi ?? 0), 0);
    const dur = todays.reduce((s, t) => s + (t.duration_seconds ?? 0), 0);
    const idle = todays.reduce((s, t) => s + (t.idle_seconds ?? 0), 0);
    const maxS = Math.max(0, ...todays.map((t) => t.max_speed_mph ?? 0));
    return { dist, dur, idle, maxS, count: todays.length };
  }, [trips]);

  const margin30 = (zeus?.revenue30 ?? 0) - (zeus?.expenses30 ?? 0);

  return (
    <div className="p-3 space-y-4">
      {/* Daily Summary */}
      <Section title="Resumo de hoje" icon={<Activity size={13} />}>
        {vehicle.address && (
          <div className="px-3 py-2.5 border-b border-border/20">
            <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground mb-0.5">Localização atual</p>
            <p className="text-[11px] text-foreground leading-snug flex items-start gap-1.5">
              <MapPin size={11} className="text-primary mt-0.5 shrink-0" />
              <span>{vehicle.address}</span>
            </p>
          </div>
        )}
        <div className="grid grid-cols-2">
          <Cell label="Distância" value={`${fmtNum(today.dist, 1)} mi`} />
          <Cell label="Duração" value={today.dur ? fmtDuration(today.dur) : ""} />
          <Cell label="Tempo parado" value={today.idle ? fmtDuration(today.idle) : ""} />
          <Cell label="Vel. máxima" value={today.maxS ? `${Math.round(today.maxS)} mph` : ""} />
        </div>
      </Section>

      {/* Reserva atual */}
      <Section title="Reserva atual" icon={<CalendarClock size={13} />}>
        {zeus?.current ? (
          <BookingBlock booking={zeus.current} onOpen={(id) => navigate(`/admin/bookings/${id}`)} />
        ) : (
          <EmptyRow>Veículo disponível. sem reserva ativa hoje</EmptyRow>
        )}
      </Section>

      {/* Próxima reserva */}
      <Section title="Próxima reserva" icon={<CalendarRange size={13} />}>
        {zeus?.next ? (
          <BookingBlock booking={zeus.next} onOpen={(id) => navigate(`/admin/bookings/${id}`)} />
        ) : (
          <EmptyRow>Nenhuma reserva agendada</EmptyRow>
        )}
      </Section>

      {/* Financeiro 30 dias */}
      <Section title="Financeiro (últimos 30 dias)" icon={<DollarSign size={13} />}>
        <div className="grid grid-cols-3">
          <Cell label="Receita" value={fmtMoney(zeus?.revenue30)} />
          <Cell label="Despesas" value={fmtMoney(zeus?.expenses30)} />
          <Cell
            label="Margem"
            value={fmtMoney(margin30)}
            valueClass={margin30 >= 0 ? "text-green-500" : "text-red-500"}
          />
        </div>
      </Section>

      {/* Condição & Sinistros */}
      <Section title="Condição & sinistros" icon={<Heart size={13} />}>
        <div className="grid grid-cols-2">
          <ConditionCell label="Pneus" value={zeus?.condition.tire} />
          <ConditionCell label="Freios" value={zeus?.condition.brake} />
          <ConditionCell label="Bateria" value={zeus?.condition.battery} />
          <ConditionCell label="Lataria" value={zeus?.condition.body} />
        </div>
        {zeus && zeus.incidentsOpen > 0 && (
          <div className="px-3 py-2 border-t border-border/20 flex items-center gap-2 text-[11px] text-red-500">
            <AlertTriangle size={12} />
            <span>{zeus.incidentsOpen} sinistro(s) em aberto</span>
          </div>
        )}
        {zeus?.lastIncident && (
          <div className="px-3 py-2 border-t border-border/20">
            <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">Último registro</p>
            <p className="text-[11px] text-foreground mt-0.5 leading-snug">
              {zeus.lastIncident.title ?? zeus.lastIncident.type ?? "Sinistro"}
              <span className="text-muted-foreground"> • {fmtDate(zeus.lastIncident.incident_date)}</span>
              {zeus.lastIncident.actual_cost != null && (
                <span className="text-muted-foreground"> • {fmtMoney(zeus.lastIncident.actual_cost)}</span>
              )}
            </p>
          </div>
        )}
      </Section>

      {/* Vehicle Summary */}
      <Section title="Veículo" icon={<Car size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Apelido" value={detail?.name ?? vehicle.name} />
          <Cell label="Marca / Modelo" value={[detail?.brand, detail?.model].filter(Boolean).join(" ") || ""} />
          <Cell label="Ano" value={detail?.year ? String(detail.year) : detail?.manufacture_year ? String(detail.manufacture_year) : ""} />
          <Cell label="Cor" value={detail?.color ?? ""} />
          <Cell label="Placa" value={detail?.license_plate ?? ""} mono />
          <Cell label="VIN" value={detail?.vin ?? detail?.bouncie_vin ?? ""} mono small />
          <Cell label="IMEI Bouncie" value={detail?.bouncie_imei ?? ""} mono small />
          <Cell label="Odômetro" value={vehicle.odometer != null ? `${fmtNum(vehicle.odometer)} mi` : detail?.current_odometer ? `${fmtNum(detail.current_odometer)} mi` : ""} />
          <Cell label="Motor" value={detail?.engine_size ?? detail?.engine_type ?? ""} />
          <Cell label="Combustível" value={detail?.fuel ?? ""} />
          <Cell label="Câmbio" value={detail?.transmission ?? ""} />
          <Cell label="Categoria" value={detail?.category ?? ""} />
        </div>
      </Section>

      {/* Insurance */}
      <Section title="Seguro" icon={<Shield size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Apólice" value={detail?.insurance_policy ?? ""} mono small />
          <Cell label="Vencimento" value={fmtDate(detail?.insurance_expiry)} />
        </div>
      </Section>

      {/* Maintenance */}
      <Section title="Manutenção" icon={<Wrench size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Última revisão" value={fmtDate(detail?.last_service_date)} />
          <Cell label="Próxima (mi)" value={detail?.next_service_km ? `${fmtNum(detail.next_service_km)} mi` : ""} />
          <Cell label="Licenciamento" value={fmtDate(detail?.registration_expiry)} />
        </div>
      </Section>
    </div>
  );
}

function BookingBlock({ booking, onOpen }: { booking: ZeusBooking; onOpen: (id: string) => void }) {
  return (
    <div className="px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-foreground truncate">{formatPersonName(booking.customer_name)}</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{booking.booking_number ?? ""}</p>
        </div>
        <button
          onClick={() => onOpen(booking.id)}
          className="text-[9px] uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
        >
          Abrir <ExternalLink size={10} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <Mini label="Início" value={fmtDate(booking.pickup_date)} />
        <Mini label="Devolução" value={fmtDate(booking.return_date)} />
        <Mini label="Status" value={STATUS_LABEL[booking.status] ?? booking.status} />
        <Mini label="Valor" value={fmtMoney(booking.total_price)} />
        <Mini label="Contrato" value={booking.contract_status ?? ""} />
        <Mini label="Pagamento" value={booking.payment_status ?? ""} />
      </div>
      {booking.customer_phone && (
        <a
          href={`tel:${booking.customer_phone}`}
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
        >
          <Phone size={10} /> {booking.customer_phone}
        </a>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-foreground px-1 flex items-center gap-1.5">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      <div className="rounded-lg border border-border/30 bg-card/40 overflow-hidden">{children}</div>
    </div>
  );
}

function Cell({
  label, value, mono, small, valueClass,
}: { label: string; value: string; mono?: boolean; small?: boolean; valueClass?: string }) {
  return (
    <div className="px-3 py-2 border-b border-r border-border/20 last:border-r-0 odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${mono ? "font-mono" : "font-medium"} ${small ? "text-[10px]" : "text-[11px]"} break-all ${valueClass ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ConditionCell({ label, value }: { label: string; value: string | null | undefined }) {
  const key = value?.toLowerCase() ?? "";
  const cls = COND_COLOR[key] ?? "text-muted-foreground";
  const display = value ? (COND_LABEL[key] ?? value) : "";
  return <Cell label={label} value={display} valueClass={cls} />;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 border border-border/20 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-[10px] font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-3 text-[11px] text-muted-foreground text-center">{children}</p>;
}
