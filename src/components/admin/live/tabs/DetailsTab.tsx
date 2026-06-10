import { useMemo } from "react";
import { useVehicleDetail } from "@/hooks/useVehicleDetail";
import { useVehicleTrips } from "@/hooks/useVehicleTrips";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { MapPin, Gauge, Clock, Activity, Shield, Wrench, Car } from "lucide-react";

function fmtNum(v: number | null | undefined, d = 0): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m} min`;
}

export function DetailsTab({ vehicle, vehicleId }: { vehicle: LiveVehicle; vehicleId: string }) {
  const { data: detail } = useVehicleDetail(vehicleId);
  const { data: trips = [] } = useVehicleTrips(vehicleId, 2);

  const today = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todays = trips.filter((t) => t.started_at && new Date(t.started_at).toDateString() === todayStr);
    const dist = todays.reduce((s, t) => s + (t.distance_mi ?? 0), 0);
    const dur = todays.reduce((s, t) => s + (t.duration_seconds ?? 0), 0);
    const idle = todays.reduce((s, t) => s + (t.idle_seconds ?? 0), 0);
    const maxS = Math.max(0, ...todays.map((t) => t.max_speed_mph ?? 0));
    return { dist, dur, idle, maxS, count: todays.length };
  }, [trips]);

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
          <Cell label="Duração" value={today.dur ? fmtDuration(today.dur) : "—"} />
          <Cell label="Tempo parado" value={today.idle ? fmtDuration(today.idle) : "—"} />
          <Cell label="Vel. máxima" value={today.maxS ? `${Math.round(today.maxS)} mph` : "—"} />
        </div>
      </Section>

      {/* Vehicle Summary */}
      <Section title="Veículo" icon={<Car size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Apelido" value={detail?.name ?? vehicle.name} />
          <Cell label="Marca / Modelo" value={[detail?.brand, detail?.model].filter(Boolean).join(" ") || "—"} />
          <Cell label="Ano" value={detail?.year ? String(detail.year) : detail?.manufacture_year ? String(detail.manufacture_year) : "—"} />
          <Cell label="Cor" value={detail?.color ?? "—"} />
          <Cell label="Placa" value={detail?.license_plate ?? "—"} mono />
          <Cell label="VIN" value={detail?.vin ?? detail?.bouncie_vin ?? "—"} mono small />
          <Cell label="IMEI Bouncie" value={detail?.bouncie_imei ?? "—"} mono small />
          <Cell label="Odômetro" value={vehicle.odometer != null ? `${fmtNum(vehicle.odometer)} mi` : detail?.current_odometer ? `${fmtNum(detail.current_odometer)} mi` : "—"} />
          <Cell label="Motor" value={detail?.engine_size ?? detail?.engine_type ?? "—"} />
          <Cell label="Combustível" value={detail?.fuel ?? "—"} />
          <Cell label="Câmbio" value={detail?.transmission ?? "—"} />
          <Cell label="Categoria" value={detail?.category ?? "—"} />
        </div>
      </Section>

      {/* Insurance */}
      <Section title="Seguro" icon={<Shield size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Apólice" value={detail?.insurance_policy ?? "—"} mono small />
          <Cell label="Vencimento" value={fmtDate(detail?.insurance_expiry)} />
        </div>
      </Section>

      {/* Maintenance */}
      <Section title="Manutenção" icon={<Wrench size={13} />}>
        <div className="grid grid-cols-2">
          <Cell label="Última revisão" value={fmtDate(detail?.last_service_date)} />
          <Cell label="Próxima (mi)" value={detail?.next_service_km ? `${fmtNum(detail.next_service_km)} mi` : "—"} />
          <Cell label="Licenciamento" value={fmtDate(detail?.registration_expiry)} />
        </div>
      </Section>
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

function Cell({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="px-3 py-2 border-b border-r border-border/20 last:border-r-0 odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      <p className={`text-foreground mt-0.5 ${mono ? "font-mono" : "font-medium"} ${small ? "text-[10px]" : "text-[11px]"} break-all`}>
        {value}
      </p>
    </div>
  );
}
