import { useState } from "react";
import type { LiveVehicle } from "@/hooks/useFleetLive";
import { useVehicleDiagnostics } from "@/hooks/useVehicleDiagnostics";
import { Fuel, Battery, Wrench, Wifi, WifiOff, X, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

function formatDtcDescription(code: string): string {
  const map: Record<string, string> = {
    "P0300": "Falha de ignição aleatória / múltiplos cilindros",
    "P0301": "Falha de ignição no cilindro 1",
    "P0302": "Falha de ignição no cilindro 2",
    "P0303": "Falha de ignição no cilindro 3",
    "P0304": "Falha de ignição no cilindro 4",
    "P0305": "Falha de ignição no cilindro 5",
    "P0306": "Falha de ignição no cilindro 6",
    "P0420": "Eficiência do conversor catalítico abaixo do limiar",
    "P0430": "Eficiência do conversor catalítico (banco 2) abaixo do limiar",
    "P0171": "Mistura muito pobre (banco 1)",
    "P0174": "Mistura muito pobre (banco 2)",
    "P0172": "Mistura muito rica (banco 1)",
    "P0175": "Mistura muito rica (banco 2)",
    "P0442": "Pequeno vazamento no sistema de evaporação",
    "P0455": "Grande vazamento no sistema de evaporação",
    "P0456": "Vazamento mínimo no sistema de evaporação",
    "P0401": "Fluxo de recirculação de gases de escape insuficiente",
    "P0500": "Sensor de velocidade do veículo com falha",
    "P0562": "Tensão da bateria baixa",
    "P0603": "Falha na memória interna do módulo de controle",
    "P0700": "Módulo de transmissão com código de erro",
  };
  return map[code.toUpperCase()] || "";
}

export function VehicleHealthFooter({ vehicle }: { vehicle: LiveVehicle }) {
  const online = isDeviceOnline(vehicle);
  const fuel = vehicle.fuel_level;
  const milOn = !!vehicle.mil_on;
  const battery = vehicle.battery_status ?? null;
  const batteryOk = battery ? !/low|weak|bad|fail/i.test(battery) : null;
  const [open, setOpen] = useState(false);

  const { data: diagnostics } = useVehicleDiagnostics(milOn ? vehicle.vehicle_id : null);

  const engineItem = (
    <button
      onClick={() => milOn && setOpen(true)}
      className={`flex flex-col items-center text-center gap-1 ${milOn ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${milOn ? "text-red-500 bg-red-500/15" : "text-green-500 bg-green-500/15"}`}>
        <Wrench size={14} />
      </div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">Motor</p>
      <p className="text-[10px] font-medium text-foreground tabular-nums leading-tight truncate w-full">
        {milOn ? "Alerta" : "OK"}
      </p>
    </button>
  );

  const items = [
    {
      key: "fuel",
      icon: <Fuel size={14} />,
      label: "Combustível",
      value: fuel != null ? `${Math.round(fuel)}%` : "",
      color: fuelColor(fuel),
    },
    {
      key: "battery",
      icon: <Battery size={14} />,
      label: "Bateria",
      value: battery ? battery : "",
      color: batteryOk === false ? "text-red-500 bg-red-500/15" : batteryOk ? "text-green-500 bg-green-500/15" : "text-muted-foreground bg-muted/40",
    },
    {
      key: "device",
      icon: online ? <Wifi size={14} /> : <WifiOff size={14} />,
      label: "Rastreador",
      value: online ? "Online" : "Offline",
      color: online ? "text-green-500 bg-green-500/15" : "text-muted-foreground bg-muted/40",
    },
  ];

  const dtcs = diagnostics?.dtc_codes ?? [];

  return (
    <>
      <div className="border-t border-border/30 bg-background/95 backdrop-blur-sm px-3 py-2.5">
        <div className="grid grid-cols-4 gap-2">
          {engineItem}
          {items.map((it) => (
            <div key={it.key} className="flex flex-col items-center text-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${it.color}`}>
                {it.icon}
              </div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">{it.label}</p>
              <p className="text-[10px] font-medium text-foreground tabular-nums leading-tight truncate w-full">{it.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <AlertTriangle size={18} className="text-red-500" />
              Alerta do Motor
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {dtcs.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Códigos de falha detectados (DTC):</p>
                <div className="space-y-2">
                  {dtcs.map((code) => {
                    const desc = formatDtcDescription(code);
                    return (
                      <div key={code} className="flex flex-col gap-0.5 p-3 rounded-xl bg-muted/50 border border-border/40">
                        <span className="font-mono text-sm font-semibold text-foreground">{code.toUpperCase()}</span>
                        {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/40 text-sm text-muted-foreground">
                Alerta de motor detectado, mas os códigos de diagnóstico (DTC) ainda não foram recebidos do rastreador.
              </div>
            )}

            {diagnostics?.recorded_at && (
              <p className="text-[11px] text-muted-foreground">
                Ultima verificação: {new Date(diagnostics.recorded_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
