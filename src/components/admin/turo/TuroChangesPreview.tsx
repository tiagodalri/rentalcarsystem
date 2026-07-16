import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, XCircle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/formatName";
import type { Classification, BookingSnapshot } from "@/lib/turo/diffEngine";

type DateChangeKind = "return_extended" | "return_shortened" | "pickup_postponed" | "pickup_anticipated";

interface DateChangeInfo {
  reservationId: string;
  bookingNumber?: string | null;
  name: string;
  vehicleModel: string;
  kind: DateChangeKind;
  field: "pickup" | "return";
  oldDate: string;
  newDate: string;
  daysDelta: number; // sempre positivo, sinal vem do kind
  oldTime?: string | null;
  newTime?: string | null;
  oldLocation?: string | null;
  newLocation?: string | null;
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
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return String(v);
}

export function TuroChangesPreview({ classifications }: Props) {
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<"cancelled" | "enrich" | "dateChanges" | "new">("dateChanges");

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

  // Alterações de datas: pickup ou return mudaram (Turo é fonte de verdade)
  const dateChanges = useMemo<DateChangeInfo[]>(() => {
    const out: DateChangeInfo[] = [];
    for (const c of enriches) {
      if (!c.existing) continue;
      const name = formatPersonName(c.row.guestName);

      // RETURN
      const dReturn = c.diffs.find((d) => d.field === "return_date" && c.selectedFields.has(d.field));
      if (dReturn) {
        const oldDate = String(dReturn.currentValue ?? "");
        const newDate = String(dReturn.newValue ?? "");
        const delta = diffDays(oldDate, newDate);
        if (delta !== 0) {
          const dRt = c.diffs.find((d) => d.field === "return_time");
          const dRloc = c.diffs.find((d) => d.field === "return_location");
          out.push({
            reservationId: c.row.reservationId,
            bookingNumber: c.existing.booking_number,
            name,
            vehicleModel: c.row.vehicleModel,
            kind: delta > 0 ? "return_extended" : "return_shortened",
            field: "return",
            oldDate,
            newDate,
            daysDelta: Math.abs(delta),
            oldTime: dRt ? String(dRt.currentValue ?? "") : c.existing.return_time,
            newTime: dRt ? String(dRt.newValue ?? "") : c.existing.return_time,
            oldLocation: dRloc ? String(dRloc.currentValue ?? "") : c.existing.return_location,
            newLocation: dRloc ? String(dRloc.newValue ?? "") : c.existing.return_location,
          });
        }
      }

      // PICKUP
      const dPickup = c.diffs.find((d) => d.field === "pickup_date" && c.selectedFields.has(d.field));
      if (dPickup) {
        const oldDate = String(dPickup.currentValue ?? "");
        const newDate = String(dPickup.newValue ?? "");
        const delta = diffDays(oldDate, newDate);
        if (delta !== 0) {
          const dPt = c.diffs.find((d) => d.field === "pickup_time");
          const dPloc = c.diffs.find((d) => d.field === "pickup_location");
          out.push({
            reservationId: c.row.reservationId,
            bookingNumber: c.existing.booking_number,
            name,
            vehicleModel: c.row.vehicleModel,
            kind: delta > 0 ? "pickup_postponed" : "pickup_anticipated",
            field: "pickup",
            oldDate,
            newDate,
            daysDelta: Math.abs(delta),
            oldTime: dPt ? String(dPt.currentValue ?? "") : c.existing.pickup_time,
            newTime: dPt ? String(dPt.newValue ?? "") : c.existing.pickup_time,
            oldLocation: dPloc ? String(dPloc.currentValue ?? "") : c.existing.pickup_location,
            newLocation: dPloc ? String(dPloc.newValue ?? "") : c.existing.pickup_location,
          });
        }
      }
    }
    // Ordena: maior impacto primeiro
    return out.sort((a, b) => b.daysDelta - a.daysDelta);
  }, [enriches]);

  const extendedCount = dateChanges.filter((d) => d.kind === "return_extended").length;
  const shortenedCount = dateChanges.filter((d) => d.kind === "return_shortened").length;
  const pickupChangedCount = dateChanges.filter((d) => d.field === "pickup").length;


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
            ({total} reservas · {dateChanges.length} c/ datas alteradas · {cancelled.length} canceladas · {enriches.length} enriquecer · {news.length} novas)
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-primary/20 bg-card/50">
          {/* Tabs */}
          <div className="flex border-b border-border/60 text-xs overflow-x-auto">
            <TabBtn active={section === "dateChanges"} onClick={() => setSection("dateChanges")} icon={<CalendarClock className="h-3.5 w-3.5" />} label="Alterações de datas" count={dateChanges.length} />
            <TabBtn active={section === "cancelled"} onClick={() => setSection("cancelled")} icon={<XCircle className="h-3.5 w-3.5" />} label="Canceladas" count={cancelled.length} />
            <TabBtn active={section === "enrich"} onClick={() => setSection("enrich")} icon={<Pencil className="h-3.5 w-3.5" />} label="Enriquecer" count={byField.reduce((s, f) => s + f.rows.length, 0)} />
            <TabBtn active={section === "new"} onClick={() => setSection("new")} icon={<Plus className="h-3.5 w-3.5" />} label="Novas" count={news.length} />
          </div>


          <div className="max-h-[420px] overflow-y-auto p-3 space-y-2 text-xs">
            {section === "dateChanges" && (
              dateChanges.length === 0 ? (
                <Empty>Nenhuma reserva teve datas alteradas neste CSV.</Empty>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 px-1 pb-1 text-[11px]">
                    {extendedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CalendarClock className="h-3 w-3" />
                        {extendedCount} {extendedCount === 1 ? "devolução estendida" : "devoluções estendidas"}
                      </span>
                    )}
                    {shortenedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                        <CalendarClock className="h-3 w-3" />
                        {shortenedCount} {shortenedCount === 1 ? "devolução antecipada" : "devoluções antecipadas"}
                      </span>
                    )}
                    {pickupChangedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 font-medium">
                        <CalendarClock className="h-3 w-3" />
                        {pickupChangedCount} {pickupChangedCount === 1 ? "retirada alterada" : "retiradas alteradas"}
                      </span>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Cliente / Reserva</th>
                          <th className="text-left px-3 py-2 font-medium">Veículo</th>
                          <th className="text-left px-3 py-2 font-medium">Campo</th>
                          <th className="text-left px-3 py-2 font-medium">Antes</th>
                          <th className="text-left px-3 py-2 font-medium">Depois</th>
                          <th className="text-right px-3 py-2 font-medium">Variação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateChanges.map((e) => {
                          const locChanged = (e.oldLocation || "") !== (e.newLocation || "");
                          const timeChanged = (e.oldTime || "") !== (e.newTime || "");
                          const isPositive = e.kind === "return_extended" || e.kind === "pickup_anticipated";
                          const sign = e.kind === "return_extended" ? "+" : e.kind === "return_shortened" ? "−" : e.kind === "pickup_postponed" ? "→" : "←";
                          const badgeClass = isPositive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : e.field === "return"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-400";
                          const fieldLabel =
                            e.kind === "return_extended" ? "Devolução estendida"
                            : e.kind === "return_shortened" ? "Devolução antecipada"
                            : e.kind === "pickup_postponed" ? "Retirada adiada"
                            : "Retirada antecipada";
                          return (
                            <tr key={`${e.reservationId}-${e.field}`} className="border-t border-border/40 align-top">
                              <td className="px-3 py-2">
                                <div className="font-medium">{e.name}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">
                                  {e.bookingNumber ? `#${e.bookingNumber} · ` : ""}Turo #{e.reservationId}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{e.vehicleModel}</td>
                              <td className="px-3 py-2">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", badgeClass)}>
                                  {fieldLabel}
                                </span>
                              </td>
                              <td className="px-3 py-2 tabular-nums text-muted-foreground line-through opacity-70">
                                <div>{e.oldDate}{e.oldTime ? ` · ${e.oldTime}` : ""}</div>
                                {e.oldLocation && <div className="text-[10px] not-italic no-underline">{e.oldLocation}</div>}
                              </td>
                              <td className="px-3 py-2 tabular-nums font-medium">
                                <div>{e.newDate}{e.newTime ? ` · ${e.newTime}` : ""}{timeChanged && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">(novo horário)</span>}</div>
                                {e.newLocation && (
                                  <div className={cn("text-[10px] font-normal", locChanged ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                    {e.newLocation}{locChanged && " (novo local)"}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold tabular-nums", badgeClass)}>
                                  {sign}{e.daysDelta} {e.daysDelta === 1 ? "dia" : "dias"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}


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
