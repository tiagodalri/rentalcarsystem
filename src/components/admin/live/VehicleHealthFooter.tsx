import type { LiveVehicle } from "@/hooks/useFleetLive";
import { Fuel, Battery, Wrench, Wifi, WifiOff } from "lucide-react";

function fuelColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground bg-muted/40";
  if (pct < 15) return "text-red-500 bg-red-500/15";
  if (pct < 35) return "text-yellow-500 bg-yellow-500/15";
  return "text-green-500 bg-green-500/15";
}

function isDeviceOnline(v: LiveVehicle): boolean {
  if (!v.reported_at) return false;
  const diff = Date.now() - new Date(v.reported_at).getTime();
  return diff < 30 * 60_000; // last 30 min
}

export function VehicleHealthFooter({ vehicle }: { vehicle: LiveVehicle }) {
  const online = isDeviceOnline(vehicle);
  const fuel = vehicle.fuel_level;
  const milOn = !!vehicle.mil_on;
  const battery = vehicle.battery_status ?? null;
  const batteryOk = battery ? !/low|weak|bad|fail/i.test(battery) : null;

  const items = [
    {
      key: "fuel",
      icon: <Fuel size={14} />,
      label: "Combustível",
      value: fuel != null ? `${Math.round(fuel)}%` : "—",
      color: fuelColor(fuel),
    },
    {
      key: "battery",
      icon: <Battery size={14} />,
      label: "Bateria",
      value: battery ? battery : "—",
      color: batteryOk === false ? "text-red-500 bg-red-500/15" : batteryOk ? "text-green-500 bg-green-500/15" : "text-muted-foreground bg-muted/40",
    },
    {
      key: "engine",
      icon: <Wrench size={14} />,
      label: "Motor",
      value: milOn ? "Alerta" : "OK",
      color: milOn ? "text-red-500 bg-red-500/15" : "text-green-500 bg-green-500/15",
    },
    {
      key: "device",
      icon: online ? <Wifi size={14} /> : <WifiOff size={14} />,
      label: "Rastreador",
      value: online ? "Online" : "Offline",
      color: online ? "text-green-500 bg-green-500/15" : "text-muted-foreground bg-muted/40",
    },
  ];

  return (
    <div className="border-t border-border/30 bg-background/95 backdrop-blur-sm px-3 py-2.5">
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.key} className="flex flex-col items-center text-center gap-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${it.color}`}>
              {it.icon}
            </div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">{it.label}</p>
            <p className="text-[10px] font-bold text-foreground tabular-nums leading-tight truncate w-full">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
