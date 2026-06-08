import { useMemo, useState } from "react";
import { useVehicleEvents, categorizeEvent, type EventCategory, type VehicleEvent } from "@/hooks/useVehicleEvents";
import { AlertTriangle, Gauge, Activity, Plug, Wrench, Fuel, MapPin } from "lucide-react";

const TABS: { id: EventCategory; label: string }[] = [
  { id: "drive", label: "Direção" },
  { id: "vehicle", label: "Veículo" },
  { id: "care", label: "Manutenção" },
];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `Hoje • ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Telemetry/heartbeat events from the tracker that are pure noise for a human.
// (Bouncie streams "tripData"/"tripMetrics" continuously while the car is moving —
// they aren't alerts and shouldn't fill the notifications list.)
const TELEMETRY_TYPES = new Set([
  "tripdata", "tripmetrics", "location", "heartbeat", "gps", "ping", "keepalive",
]);

function isTelemetry(eventType: string): boolean {
  return TELEMETRY_TYPES.has(eventType.toLowerCase());
}

function describeEvent(e: VehicleEvent): { title: string; desc: string; icon: React.ReactNode; color: string } {
  const t = e.event_type.toLowerCase();
  const p = e.payload || {};
  if (t.includes("hardbrak")) {
    return { title: "Freada brusca", desc: e.speed_mph ? `Detectada a ${Math.round(e.speed_mph)} mph` : "Detectada durante viagem", icon: <AlertTriangle size={14} />, color: "text-yellow-500 bg-yellow-500/10" };
  }
  if (t.includes("hardaccel")) {
    return { title: "Aceleração brusca", desc: e.speed_mph ? `Detectada a ${Math.round(e.speed_mph)} mph` : "Detectada durante viagem", icon: <Gauge size={14} />, color: "text-orange-500 bg-orange-500/10" };
  }
  if (t.includes("speed")) {
    return { title: "Excesso de velocidade", desc: e.speed_mph ? `Atingiu ${Math.round(e.speed_mph)} mph` : "Acima do limite", icon: <Gauge size={14} />, color: "text-red-500 bg-red-500/10" };
  }
  if (t.includes("idle")) {
    return { title: "Veículo ocioso", desc: "Ligado e parado por tempo prolongado", icon: <Activity size={14} />, color: "text-muted-foreground bg-muted/30" };
  }
  if (t.includes("mil")) {
    const codes = (p.mil?.qualifiedEvents ?? p.dtcs ?? []).slice(0, 2).join(", ");
    return { title: "Luz de injeção acesa", desc: codes ? `Códigos: ${codes}` : "Acionada pelo sistema de bordo", icon: <Wrench size={14} />, color: "text-red-500 bg-red-500/10" };
  }
  if (t.includes("battery")) {
    return { title: "Alerta de bateria", desc: "Tensão da bateria fora do padrão", icon: <Plug size={14} />, color: "text-yellow-500 bg-yellow-500/10" };
  }
  if (t.includes("disconnect")) {
    return { title: "Rastreador desconectado", desc: "O dispositivo parou de transmitir", icon: <Plug size={14} />, color: "text-muted-foreground bg-muted/30" };
  }
  if (t.includes("connect")) {
    return { title: "Rastreador conectado", desc: "Dispositivo voltou a transmitir", icon: <Plug size={14} />, color: "text-green-500 bg-green-500/10" };
  }
  if (t.includes("tripstart")) {
    return { title: "Viagem iniciada", desc: p.startAddress ?? "Início registrado", icon: <MapPin size={14} />, color: "text-green-500 bg-green-500/10" };
  }
  if (t.includes("tripend")) {
    return { title: "Viagem encerrada", desc: p.endAddress ?? "Fim registrado", icon: <MapPin size={14} />, color: "text-blue-500 bg-blue-500/10" };
  }
  if (t.includes("fuel")) {
    return { title: "Aviso de combustível", desc: "Tanque abaixo do limite recomendado", icon: <Fuel size={14} />, color: "text-yellow-500 bg-yellow-500/10" };
  }
  if (t.includes("geofence")) {
    return { title: "Cerca virtual", desc: "Veículo entrou ou saiu de uma área monitorada", icon: <MapPin size={14} />, color: "text-blue-500 bg-blue-500/10" };
  }
  // Fallback: never show raw API names. Humanize gracefully.
  return { title: "Atualização do veículo", desc: "Novo dado recebido do rastreador", icon: <Activity size={14} />, color: "text-muted-foreground bg-muted/30" };
}

export function NotificationsTab({ vehicleId }: { vehicleId: string }) {
  const [tab, setTab] = useState<EventCategory>("drive");
  const { data: rawEvents = [], isLoading } = useVehicleEvents(vehicleId, 60);

  // Strip pure telemetry/heartbeat events — they aren't alerts.
  const events = useMemo(() => rawEvents.filter((e) => !isTelemetry(e.event_type)), [rawEvents]);

  const byCategory = useMemo(() => {
    const map: Record<EventCategory, VehicleEvent[]> = { drive: [], vehicle: [], care: [] };
    for (const e of events) map[categorizeEvent(e.event_type)].push(e);
    return map;
  }, [events]);

  const list = byCategory[tab];

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-sm font-bold text-foreground">Notificações</h3>

      <div className="flex gap-1 border border-border/30 rounded-lg p-0.5 bg-muted/20">
        {TABS.map((t) => {
          const count = byCategory[t.id].length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[9px] px-1 rounded ${active ? "bg-primary/20" : "bg-muted/40"} tabular-nums`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-xs text-muted-foreground">Carregando…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-lg border border-dashed border-border/40">
          <Activity size={20} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Nenhuma notificação nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((e) => {
            const m = describeEvent(e);
            return (
              <div key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/30 bg-card/40">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.color}`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums mt-1">{fmtWhen(e.occurred_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
