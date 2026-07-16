import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/admin/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type Toll = {
  id: string;
  toll_datetime: string;
  location: string;
  amount: number;
  charged_to_customer: boolean;
  booking_id: string | null;
  customer_id: string | null;
  bookings?: { id: string; booking_number: string | null; customer_name: string | null } | null;
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export function VehicleEpassTolls({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate();
  const [tolls, setTolls] = useState<Toll[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>("all");
  const [marking, setMarking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("epass_tolls")
      .select("id,toll_datetime,location,amount,charged_to_customer,booking_id,customer_id,bookings(id,booking_number,customer_name)")
      .eq("vehicle_id", vehicleId)
      .order("toll_datetime", { ascending: false });
    setTolls((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [vehicleId]);

  const months = useMemo(() => {
    const s = new Set<string>();
    tolls.forEach((t) => s.add(monthKey(t.toll_datetime)));
    return Array.from(s).sort().reverse();
  }, [tolls]);

  const filtered = useMemo(() => {
    if (month === "all") return tolls;
    return tolls.filter((t) => monthKey(t.toll_datetime) === month);
  }, [tolls, month]);

  const total = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const charged = filtered.filter((t) => t.charged_to_customer).reduce((s, t) => s + Number(t.amount), 0);
  const pending = total - charged;
  const orphans = filtered.filter((t) => !t.booking_id).length;

  const pendingIds = filtered.filter((t) => !t.charged_to_customer && t.booking_id).map((t) => t.id);
  const markAllCharged = async () => {
    if (!pendingIds.length) return;
    setMarking(true);
    const { error } = await supabase
      .from("epass_tolls")
      .update({ charged_to_customer: true, charged_at: new Date().toISOString() })
      .in("id", pendingIds);
    setMarking(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Atualizado", description: `${pendingIds.length} pedágios marcados como cobrados.` });
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (tolls.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center space-y-2">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum pedágio E-Pass registrado para este veículo.</p>
          <p className="text-xs text-muted-foreground/60">Importe extratos em Gestão → Sincronizar E-Pass.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros e KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total no período" value={`$${total.toFixed(2)}`} hint={`${filtered.length} pedágios`} />
        <KpiCard label="Já cobrado" value={`$${charged.toFixed(2)}`} valueClassName="text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="Pendente de cobrança" value={`$${pending.toFixed(2)}`} valueClassName="text-amber-600 dark:text-amber-400" />
        <KpiCard label="Sem reserva" value={orphans} />
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Período:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {pendingIds.length > 0 && (
          <Button size="sm" variant="outline" onClick={markAllCharged} disabled={marking}>
            {marking && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Marcar {pendingIds.length} como cobrados
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card className="border-border/40">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Data / Hora</th>
                  <th className="px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2 font-medium">Reserva</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-center">Repasse</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {new Date(t.toll_datetime).toLocaleString("pt-BR", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.location}</td>
                    <td className="px-3 py-2">
                      {t.booking_id && t.bookings ? (
                        <button
                          onClick={() => navigate(`/admin/bookings/${t.booking_id}`)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {t.bookings.booking_number || "reserva"}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Sem reserva</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">${Number(t.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {t.charged_to_customer ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> Cobrado
                        </span>
                      ) : t.booking_id ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[11px]">Pendente</span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]"></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
