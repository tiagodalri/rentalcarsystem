import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Receipt, CheckCircle2, Loader2, ExternalLink, Download, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatPersonName } from "@/lib/formatName";

type Toll = {
  id: string;
  toll_datetime: string;
  location: string;
  amount: number;
  charged_to_customer: boolean;
  charged_at: string | null;
  booking_id: string | null;
  vehicle_id: string | null;
  customer_id: string | null;
  transponder_number: string | null;
  vehicles?: { id: string; name: string; license_plate: string | null } | null;
  bookings?: { id: string; booking_number: string | null; customer_name: string | null; pickup_date: string; return_date: string } | null;
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function AdminTolls() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tolls, setTolls] = useState<Toll[]>([]);
  const [tab, setTab] = useState<"all" | "pending" | "orphans">("all");
  const [month, setMonth] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("epass_tolls")
      .select(
        "id,toll_datetime,location,amount,charged_to_customer,charged_at,booking_id,vehicle_id,customer_id,transponder_number,vehicles(id,name,license_plate),bookings(id,booking_number,customer_name,pickup_date,return_date)"
      )
      .order("toll_datetime", { ascending: false })
      .limit(5000);
    setTolls((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const months = useMemo(() => {
    const s = new Set<string>();
    tolls.forEach((t) => s.add(monthKey(t.toll_datetime)));
    return Array.from(s).sort().reverse();
  }, [tolls]);

  const vehicles = useMemo(() => {
    const m = new Map<string, string>();
    tolls.forEach((t) => { if (t.vehicles) m.set(t.vehicles.id, t.vehicles.name); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tolls]);

  const filtered = useMemo(() => {
    return tolls.filter((t) => {
      if (tab === "pending" && (t.charged_to_customer || !t.booking_id)) return false;
      if (tab === "orphans" && t.booking_id) return false;
      if (month !== "all" && monthKey(t.toll_datetime) !== month) return false;
      if (vehicleFilter !== "all" && t.vehicle_id !== vehicleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.location} ${t.vehicles?.name || ""} ${t.vehicles?.license_plate || ""} ${t.bookings?.customer_name || ""} ${t.bookings?.booking_number || ""} ${t.transponder_number || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tolls, tab, month, vehicleFilter, search]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, t) => s + Number(t.amount), 0);
    const charged = filtered.filter((t) => t.charged_to_customer).reduce((s, t) => s + Number(t.amount), 0);
    const pending = filtered.filter((t) => !t.charged_to_customer && t.booking_id).reduce((s, t) => s + Number(t.amount), 0);
    const orphans = filtered.filter((t) => !t.booking_id).reduce((s, t) => s + Number(t.amount), 0);
    return { total, charged, pending, orphans, count: filtered.length };
  }, [filtered]);

  const pendingIds = filtered.filter((t) => !t.charged_to_customer && t.booking_id).map((t) => t.id);

  const markCharged = async () => {
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

  const exportCsv = () => {
    const rows = [
      ["Data/Hora", "Local", "Veiculo", "Placa", "Transponder", "Reserva", "Cliente", "Valor", "Cobrado", "Cobrado em"],
      ...filtered.map((t) => [
        new Date(t.toll_datetime).toLocaleString("pt-BR", { timeZone: "America/New_York" }),
        t.location,
        t.vehicles?.name || "",
        t.vehicles?.license_plate || "",
        t.transponder_number || "",
        t.bookings?.booking_number || "",
        formatPersonName(t.bookings?.customer_name) || "",
        Number(t.amount).toFixed(2),
        t.charged_to_customer ? "sim" : "nao",
        t.charged_at ? new Date(t.charged_at).toLocaleString("pt-BR") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedagios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-h1 text-2xl flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" /> Pedágios E-Pass
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada de todos os pedágios importados, atrelamento a reservas e cobrança do cliente.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/40">
          <CardContent className="py-5 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total (filtro)</p>
            <p className="admin-kpi text-2xl tabular-nums">${kpis.total.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">{kpis.count} pedágios</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="py-5 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Já cobrado</p>
            <p className="admin-kpi text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">${kpis.charged.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="py-5 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendente</p>
            <p className="admin-kpi text-2xl tabular-nums text-amber-600 dark:text-amber-400">${kpis.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="py-5 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sem reserva</p>
            <p className="admin-kpi text-2xl tabular-nums">${kpis.orphans.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + ações */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar local, cliente, placa..." className="h-9 w-64 pl-8 text-xs" />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="h-9 w-[220px] text-xs"><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicles.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
          </Button>
          {pendingIds.length > 0 && (
            <Button size="sm" onClick={markCharged} disabled={marking}>
              {marking && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Marcar {pendingIds.length} como cobrados
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="pending">Pendentes de cobrança</TabsTrigger>
          <TabsTrigger value="orphans">Sem reserva</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="py-16 text-center space-y-2">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum pedágio encontrado com os filtros atuais.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/40">
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[700px]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Data / Hora</th>
                        <th className="px-3 py-2 font-medium">Local</th>
                        <th className="px-3 py-2 font-medium">Veículo</th>
                        <th className="px-3 py-2 font-medium">Reserva / Cliente</th>
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
                            {t.vehicles ? (
                              <button onClick={() => navigate(`/admin/vehicles/${t.vehicles!.id}?tab=tolls`)} className="text-left hover:underline">
                                <div className="font-medium">{t.vehicles.name}</div>
                                {t.vehicles.license_plate && <div className="text-[10px] text-muted-foreground">{t.vehicles.license_plate}</div>}
                              </button>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Transponder {t.transponder_number}</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {t.booking_id && t.bookings ? (
                              <button onClick={() => navigate(`/admin/bookings/${t.booking_id}`)} className="text-left hover:underline">
                                <div className="inline-flex items-center gap-1 text-primary font-medium">
                                  {t.bookings.booking_number || "reserva"}
                                  <ExternalLink className="h-3 w-3" />
                                </div>
                                <div className="text-[10px] text-muted-foreground">{formatPersonName(t.bookings.customer_name)}</div>
                              </button>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Sem reserva</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">${Number(t.amount).toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            {t.charged_to_customer ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                <CheckCircle2 className="h-3 w-3" /> Cobrado
                              </span>
                            ) : t.booking_id ? (
                              <span className="text-amber-600 dark:text-amber-400 text-[11px]">Pendente</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
