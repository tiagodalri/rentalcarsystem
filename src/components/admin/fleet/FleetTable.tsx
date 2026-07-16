import { useNavigate } from "react-router-dom";
import { Car, Check, X as XIcon, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { getCoverImage, hasCoverImage } from "@/data/vehicleImages";
import { storageThumb } from "@/lib/storageThumb";

function VehicleThumb({ name, src }: { name: string; src: string }) {
  const fallback = hasCoverImage(name) ? getCoverImage(name) : "";
  const [current, setCurrent] = useState(src || fallback);
  const [errored, setErrored] = useState(false);
  if (!current || errored) {
    return <Car size={14} className="text-muted-foreground/40" />;
  }
  return (
    <img
      src={current}
      alt={name}
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback);
        else setErrored(true);
      }}
    />
  );
}

export type FleetTableVehicle = {
  id: string;
  name: string;
  license_plate: string | null;
  category: string;
  status: string;
  published: boolean;
  daily_price_usd: number;
  default_deposit_amount: number | null;
  default_franchise_amount: number | null;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  image_url: string | null;
  photos: string[] | null;
};

type Props = {
  vehicles: FleetTableVehicle[];
  onTogglePublished: (v: FleetTableVehicle) => void;
  onInlineSave: (id: string, patch: Partial<FleetTableVehicle>) => Promise<void>;
  onDelete: (id: string) => void;
};

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  rented: "Alugado",
  maintenance: "Manutenção",
  preparing: "Em Preparação",
  unavailable: "Indisponível",
};
const STATUS_COLOR: Record<string, string> = {
  available: "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/30",
  rented: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  maintenance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/30",
  preparing: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/30",
  unavailable: "bg-destructive/10 text-destructive border-destructive/30",
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
const fmtMoney = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "";

const isExpiring = (d: string | null) => {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  return dt >= now && dt <= in30;
};

export default function FleetTable({ vehicles, onTogglePublished, onInlineSave, onDelete }: Props) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState<{ id: string; field: "daily_price_usd" | "default_deposit_amount" | "default_franchise_amount" | "status" } | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const startEdit = (
    id: string,
    field: "daily_price_usd" | "default_deposit_amount" | "default_franchise_amount" | "status",
    current: any,
  ) => {
    setEditing({ id, field });
    setDraft(current == null ? "" : String(current));
  };

  const commit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const patch: any = {};
      if (editing.field === "status") patch.status = draft;
      else patch[editing.field] = draft === "" ? 0 : Number(draft);
      await onInlineSave(editing.id, patch);
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 border-b border-border/40 whitespace-nowrap">
              <th className="px-3 py-3 font-medium">Veículo</th>
              <th className="px-3 py-3 font-medium">Placa</th>
              <th className="px-3 py-3 font-medium">Categoria</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium text-right">Diária</th>
              <th className="px-3 py-3 font-medium text-right">Caução</th>
              <th className="px-3 py-3 font-medium text-right">Franquia</th>
              <th className="px-3 py-3 font-medium">Seguro</th>
              <th className="px-3 py-3 font-medium">Registro</th>
              <th className="px-3 py-3 font-medium text-right">Ações</th>
              <th className="px-3 py-3 font-medium">Site</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const raw = v.image_url || (v.photos && v.photos[0]) || "";
              const dbImg = raw && !raw.includes("placeholder") ? raw : "";
              const thumb = storageThumb(dbImg, 80, 60) || (hasCoverImage(v.name) ? getCoverImage(v.name) : "");
              const isEditingCell = (f: string) => editing?.id === v.id && editing?.field === f;
              return (
                <tr
                  key={v.id}
                  className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => navigate(`/admin/fleet/${v.id}`)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <div className="h-9 w-12 rounded-md bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                        <VehicleThumb name={v.name} src={thumb} />
                      </div>

                      <span className="font-normal text-foreground whitespace-nowrap tracking-[-0.005em]">{v.name}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground/80 uppercase tracking-wider whitespace-nowrap">{v.license_plate || ""}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{v.category}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {isEditingCell("status") ? (
                      <div className="inline-flex items-center gap-1">
                        <select
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-7 px-1.5 text-xs rounded border border-border/60 bg-background"
                        >
                          {Object.entries(STATUS_LABEL).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                        <button disabled={saving} onClick={commit} className="h-7 w-7 rounded inline-flex items-center justify-center text-primary hover:bg-primary/10"><Check size={13} /></button>
                        <button onClick={() => setEditing(null)} className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-accent"><XIcon size={13} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(v.id, "status", v.status)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[v.status] || "bg-muted text-muted-foreground border-border"}`}
                      >
                        {STATUS_LABEL[v.status] || v.status}
                      </button>
                    )}
                  </td>
                  {(["daily_price_usd", "default_deposit_amount", "default_franchise_amount"] as const).map((f) => (
                    <td key={f} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {isEditingCell(f) ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="w-20 h-7 px-1.5 text-xs rounded border border-border/60 bg-background text-right tabular-nums"
                          />
                          <button disabled={saving} onClick={commit} className="h-7 w-7 rounded inline-flex items-center justify-center text-primary hover:bg-primary/10"><Check size={13} /></button>
                          <button onClick={() => setEditing(null)} className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-accent"><XIcon size={13} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(v.id, f, (v as any)[f])}
                          className="font-normal text-foreground hover:text-primary tabular-nums"
                        >
                          {fmtMoney((v as any)[f])}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 whitespace-nowrap tabular-nums ${isExpiring(v.insurance_expiry) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {fmtDate(v.insurance_expiry)}
                  </td>
                  <td className={`px-3 py-2.5 whitespace-nowrap tabular-nums ${isExpiring(v.registration_expiry) ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {fmtDate(v.registration_expiry)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/admin/fleet/${v.id}?tab=details`)}
                      className="text-muted-foreground hover:text-primary p-1.5 rounded transition-colors"
                      title="Editar ficha completa"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(v.id)}
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={v.published}
                      onCheckedChange={() => onTogglePublished(v)}
                      aria-label={v.published ? "Desativar do site" : "Ativar no site"}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
