import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Loader2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BouncieDevice = {
  imei: string;
  vin: string | null;
  model: string | null;
  make: string | null;
  year: number | null;
  nickName: string | null;
  address: string | null;
};

type VehicleOption = {
  id: string;
  name: string;
  license_plate: string | null;
  bouncie_imei: string | null;
};

export function UnlinkedBouncieDevices({ onLinked }: { onLinked?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [devices, setDevices] = useState<BouncieDevice[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [devRes, vehRes] = await Promise.all([
        supabase.functions.invoke("bouncie-devices"),
        supabase
          .from("vehicles")
          .select("id, name, license_plate, bouncie_imei")
          .order("name"),
      ]);

      if (devRes.error) throw new Error(devRes.error.message);
      const allDevices: BouncieDevice[] = (devRes.data as any)?.devices ?? [];
      const vehs = (vehRes.data ?? []) as VehicleOption[];
      const linkedImeis = new Set(
        vehs.map((v) => v.bouncie_imei).filter(Boolean) as string[]
      );

      setDevices(allDevices.filter((d) => !linkedImeis.has(d.imei)));
      setVehicles(vehs);
    } catch (e) {
      console.error("[UnlinkedBouncieDevices] load:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function link(device: BouncieDevice) {
    const vehicleId = selection[device.imei];
    if (!vehicleId) {
      toast.error("Selecione um veículo");
      return;
    }
    setLinking(device.imei);
    try {
      const payload: Record<string, string | null> = { bouncie_imei: device.imei };
      if (device.vin) payload.bouncie_vin = device.vin;
      const { error } = await supabase
        .from("vehicles")
        .update(payload)
        .eq("id", vehicleId);
      if (error) throw error;
      toast.success("Rastreador vinculado");
      setDevices((prev) => prev.filter((d) => d.imei !== device.imei));
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId ? { ...v, bouncie_imei: device.imei } : v
        )
      );
      onLinked?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao vincular");
    } finally {
      setLinking(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border/30 bg-card/50 p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> Buscando rastreadores Bouncie…
      </div>
    );
  }

  if (devices.length === 0) return null;

  const availableVehicles = vehicles.filter((v) => !v.bouncie_imei);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-primary/10 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Radio size={12} />
          Rastreadores não vinculados ({devices.length})
        </span>
        {open ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} className="text-primary" />}
      </button>

      {open && (
        <div className="p-2 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
          {devices.map((d) => {
            const label =
              d.nickName ||
              [d.make, d.model, d.year].filter(Boolean).join(" ") ||
              `IMEI ${d.imei.slice(-5)}`;
            const subtitle =
              d.nickName && (d.make || d.model)
                ? [d.make, d.model, d.year].filter(Boolean).join(" ")
                : null;
            return (
              <div
                key={d.imei}
                className="rounded-md border border-border/40 bg-card/60 p-2.5 space-y-2"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground truncate">{label}</p>
                  {subtitle && (
                    <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground/70">
                    IMEI •••{d.imei.slice(-5)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selection[d.imei] ?? ""}
                    onChange={(e) =>
                      setSelection((s) => ({ ...s, [d.imei]: e.target.value }))
                    }
                    className="flex-1 min-w-0 text-[11px] rounded-md border border-border/40 bg-background px-2 py-1 text-foreground"
                  >
                    <option value="">Selecionar veículo…</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.license_plate ? `. ${v.license_plate}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => link(d)}
                    disabled={linking === d.imei || !selection[d.imei]}
                    className="flex items-center gap-1 rounded-md gold-gradient text-primary-foreground px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {linking === d.imei ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Link2 size={11} />
                    )}
                    Vincular
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
