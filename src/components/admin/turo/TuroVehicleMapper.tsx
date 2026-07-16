import { useEffect, useState } from "react";
import { Car, Save, Check } from "lucide-react";
import { useVehiclesDB } from "@/hooks/useVehiclesDB";
import { saveVehicleMapping } from "@/lib/turo/applyChanges";
import { toast } from "@/hooks/use-toast";

interface Props {
  turoVehicleName: string;
  onMapped: (vehicleId: string) => void;
}

export function TuroVehicleMapper({ turoVehicleName, onMapped }: Props) {
  const { vehicles, loading } = useVehiclesDB({ includeSensitive: true });
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(false); }, [turoVehicleName]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveVehicleMapping(turoVehicleName, selected);
      setSaved(true);
      onMapped(selected);
      toast({ title: "Veículo mapeado", description: `"${turoVehicleName}" → ${vehicles.find((v) => v.id === selected)?.name}` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar mapeamento", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loading || saving || saved}
        className="flex-1 h-8 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value=""> escolher veículo da frota </option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} {v.license_plate ? `(${v.license_plate})` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        disabled={!selected || saving || saved}
        className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 inline-flex items-center gap-1.5"
      >
        {saved ? <><Check className="h-3 w-3" /> Salvo</> : <><Save className="h-3 w-3" /> Mapear</>}
      </button>
    </div>
  );
}
