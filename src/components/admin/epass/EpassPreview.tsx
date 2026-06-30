import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPersonName } from "@/lib/formatName";
import type { AssignedToll } from "@/lib/epass/assignEngine";

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/New_York",
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function EpassPreview({ assigned }: { assigned: AssignedToll[] }) {
  const matched = useMemo(() => assigned.filter((t) => t.status === "matched"), [assigned]);
  const noBooking = useMemo(() => assigned.filter((t) => t.status === "no_booking"), [assigned]);
  const noVehicle = useMemo(() => assigned.filter((t) => t.status === "no_vehicle"), [assigned]);
  const total = useMemo(() => assigned.reduce((s, t) => s + t.amount, 0), [assigned]);
  const totalMatched = useMemo(() => matched.reduce((s, t) => s + t.amount, 0), [matched]);

  const transpondersFaltando = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const t of noVehicle) {
      const e = map.get(t.transponder_number) || { count: 0, amount: 0 };
      e.count++; e.amount += t.amount;
      map.set(t.transponder_number, e);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [noVehicle]);

  const [tab, setTab] = useState("matched");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Total pedagios" value={assigned.length} />
        <Kpi label="Atribuidos" value={`${matched.length}`} hint={fmtUsd(totalMatched)} tone="success" />
        <Kpi label="Sem reserva" value={noBooking.length} tone="warning" />
        <Kpi label="Sem veiculo" value={noVehicle.length} tone="danger" />
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Valor total importado</div>
        <div className="text-lg font-semibold tabular-nums">{fmtUsd(total)}</div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="matched">Atribuidos ({matched.length})</TabsTrigger>
          <TabsTrigger value="no_booking">Sem reserva ({noBooking.length})</TabsTrigger>
          <TabsTrigger value="no_vehicle">Sem veiculo ({noVehicle.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="mt-3">
          <TollTable rows={matched} showBooking showCustomer />
        </TabsContent>
        <TabsContent value="no_booking" className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">
            Pedagios cujo veiculo foi identificado, mas o horario nao caiu dentro de nenhuma reserva ativa
            (provavelmente uso interno, movimentacao ou manutencao).
          </p>
          <TollTable rows={noBooking} />
        </TabsContent>
        <TabsContent value="no_vehicle" className="mt-3">
          {transpondersFaltando.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mb-3 text-xs">
              <div className="font-medium mb-1">Transponders sem veiculo vinculado:</div>
              <ul className="space-y-0.5">
                {transpondersFaltando.map(([t, info]) => (
                  <li key={t} className="tabular-nums">
                    <span className="font-mono">{t}</span> — {info.count} pedagios · {fmtUsd(info.amount)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                Cadastre o numero do transponder no campo "E-Pass" do veiculo na frota e reimporte.
              </p>
            </div>
          )}
          <TollTable rows={noVehicle} hideVehicle />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-red-600 dark:text-red-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

function TollTable({
  rows, showBooking, showCustomer, hideVehicle,
}: {
  rows: AssignedToll[];
  showBooking?: boolean;
  showCustomer?: boolean;
  hideVehicle?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-6">Nenhum pedagio nesta categoria.</div>;
  }
  return (
    <div className="rounded-xl border border-border/60 overflow-auto max-h-[480px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/40 backdrop-blur">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Data/Hora (NY)</th>
            <th className="px-3 py-2 font-medium">Transponder</th>
            {!hideVehicle && <th className="px-3 py-2 font-medium">Veiculo</th>}
            {showBooking && <th className="px-3 py-2 font-medium">Reserva</th>}
            {showCustomer && <th className="px-3 py-2 font-medium">Cliente</th>}
            <th className="px-3 py-2 font-medium">Local</th>
            <th className="px-3 py-2 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDateTime(r.toll_datetime)}</td>
              <td className="px-3 py-1.5 font-mono text-[11px]">{r.transponder_number}</td>
              {!hideVehicle && (
                <td className="px-3 py-1.5">
                  <div>{r.vehicle_name || "—"}</div>
                  {r.vehicle_plate && <div className="text-[10px] text-muted-foreground">{r.vehicle_plate}</div>}
                </td>
              )}
              {showBooking && <td className="px-3 py-1.5 font-mono text-[11px]">{r.booking_number || "—"}</td>}
              {showCustomer && <td className="px-3 py-1.5">{r.customer_name ? formatPersonName(r.customer_name) : "—"}</td>}
              <td className="px-3 py-1.5 text-muted-foreground">{r.location}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtUsd(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
