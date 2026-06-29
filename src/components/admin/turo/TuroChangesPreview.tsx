import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, XCircle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/formatName";
import type { Classification, BookingSnapshot } from "@/lib/turo/diffEngine";

interface ExtensionInfo {
  reservationId: string;
  bookingNumber?: string | null;
  name: string;
  vehicleModel: string;
  oldReturnDate: string;
  newReturnDate: string;
  daysAdded: number;
  oldReturnTime?: string | null;
  newReturnTime?: string | null;
  oldReturnLocation?: string | null;
  newReturnLocation?: string | null;
}

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface Props {
  classifications: Classification[];
}

function fmt(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(v);
}

export function TuroChangesPreview({ classifications }: Props) {
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<"cancelled" | "enrich" | "extensions" | "new">("extensions");

  const selected = useMemo(() => classifications.filter((c) => c.selected), [classifications]);

  const cancelled = selected.filter((c) => c.kind === "cancelled_csv");
  const news = selected.filter((c) => c.kind === "new");
  const enriches = selected.filter((c) => c.kind === "enrich" && c.selectedFields.size > 0);

  // Para enrich: agrupar por campo, listar reservas afetadas
  const byField = useMemo(() => {
    const map = new Map<string, { label: string; rows: { name: string; reservationId: string; bookingNumber?: string | null; from: any; to: any }[] }>();
    for (const c of enriches) {
      for (const d of c.diffs) {
        if (!c.selectedFields.has(d.field)) continue;
        const key = String(d.field);
        const entry = map.get(key) || { label: d.label, rows: [] };
        entry.rows.push({
          name: formatPersonName(c.row.guestName),
          reservationId: c.row.reservationId,
          bookingNumber: c.existing?.booking_number,
          from: d.currentValue,
          to: d.newValue,
        });
        map.set(key, entry);
      }
    }
    return Array.from(map.entries()).map(([field, v]) => ({ field, ...v })).sort((a, b) => b.rows.length - a.rows.length);
  }, [enriches]);

  const total = selected.length;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">Preview das mudanças</span>
          <span className="text-xs text-muted-foreground">
            ({total} reservas · {cancelled.length} canceladas · {enriches.length} enriquecer · {news.length} novas)
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-primary/20 bg-card/50">
          {/* Tabs */}
          <div className="flex border-b border-border/60 text-xs">
            <TabBtn active={section === "cancelled"} onClick={() => setSection("cancelled")} icon={<XCircle className="h-3.5 w-3.5" />} label="Canceladas" count={cancelled.length} />
            <TabBtn active={section === "enrich"} onClick={() => setSection("enrich")} icon={<Pencil className="h-3.5 w-3.5" />} label="Enriquecer" count={byField.reduce((s, f) => s + f.rows.length, 0)} />
            <TabBtn active={section === "new"} onClick={() => setSection("new")} icon={<Plus className="h-3.5 w-3.5" />} label="Novas" count={news.length} />
          </div>

          <div className="max-h-[420px] overflow-y-auto p-3 space-y-2 text-xs">
            {section === "cancelled" && (
              cancelled.length === 0 ? (
                <Empty>Nenhuma cancelada selecionada.</Empty>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium">Veículo</th>
                        <th className="text-left px-3 py-2 font-medium">Datas</th>
                        <th className="text-right px-3 py-2 font-medium">Valor</th>
                        <th className="text-left px-3 py-2 font-medium">Status final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelled.map((c) => (
                        <tr key={c.row.reservationId} className="border-t border-border/40">
                          <td className="px-3 py-2">
                            <div className="font-medium">{formatPersonName(c.row.guestName)}</div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">Turo #{c.row.reservationId}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{c.row.vehicleModel}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{c.row.pickupDate} → {c.row.returnDate}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            ${(c.row.totalEarnings ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-600 dark:text-red-400">
                              cancelled
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {section === "enrich" && (
              byField.length === 0 ? (
                <Empty>Nenhum campo de enriquecimento marcado.</Empty>
              ) : (
                <div className="space-y-3">
                  {byField.map((f) => (
                    <div key={f.field} className="rounded-lg border border-border/60 overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                        <span className="font-medium">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{f.rows.length} {f.rows.length === 1 ? "reserva" : "reservas"}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium">Cliente</th>
                            <th className="text-left px-3 py-1.5 font-medium">Atual</th>
                            <th className="text-left px-3 py-1.5 font-medium">Novo (CSV)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.rows.map((r) => (
                            <tr key={r.reservationId} className="border-t border-border/40">
                              <td className="px-3 py-1.5">
                                <span className="font-medium">{r.name}</span>
                                {r.bookingNumber && <span className="ml-1.5 text-[10px] text-muted-foreground">#{r.bookingNumber}</span>}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums text-muted-foreground line-through opacity-70">{fmt(r.from)}</td>
                              <td className="px-3 py-1.5 tabular-nums font-medium">{fmt(r.to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )
            )}

            {section === "new" && (
              news.length === 0 ? (
                <Empty>Nenhuma reserva nova selecionada.</Empty>
              ) : (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 font-medium">Veículo</th>
                        <th className="text-left px-3 py-2 font-medium">Datas</th>
                        <th className="text-right px-3 py-2 font-medium">Valor</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {news.map((c) => (
                        <tr key={c.row.reservationId} className="border-t border-border/40">
                          <td className="px-3 py-2 font-medium">{formatPersonName(c.row.guestName)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.row.vehicleModel}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{c.row.pickupDate} → {c.row.returnDate}</td>
                          <td className="px-3 py-2 text-right tabular-nums">${(c.row.totalEarnings ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors",
        active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="tabular-nums opacity-70">({count})</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-muted-foreground py-8">{children}</div>;
}
