import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/admin/EmptyState";
import { Wallet, Plus, Search, Loader2, Download, Sparkles, ExternalLink, Trash2, Paperclip, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ExpenseFormSheet } from "@/components/admin/ExpenseFormSheet";
import { formatPersonName } from "@/lib/formatName";

type Row = {
  id: string;
  vehicle_id: string;
  booking_id: string | null;
  type: string;
  amount: number;
  expense_date: string;
  supplier: string | null;
  description: string | null;
  notes: string | null;
  payment_method: string | null;
  status: string;
  source: string;
  receipt_url: string | null;
  ai_data: any;
  vehicles?: { id: string; name: string; license_plate: string | null } | null;
  bookings?: { id: string; booking_number: string | null; customer_name: string | null } | null;
};

const TYPE_LABEL: Record<string, string> = {
  maintenance: "Manutenção",
  fuel: "Combustível",
  cleaning: "Lavagem",
  parts: "Peças",
  insurance: "Seguro",
  fine: "Multa",
  documentation: "Documentação",
  other: "Outros",
};

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function AdminCosts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"all" | "draft" | "with_booking" | "general">("all");
  const [month, setMonth] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vehicle_expenses")
      .select(
        "id,vehicle_id,booking_id,type,amount,expense_date,supplier,description,notes,payment_method,status,source,receipt_url,ai_data,vehicles(id,name,license_plate),bookings(id,booking_number,customer_name)"
      )
      .order("expense_date", { ascending: false })
      .limit(5000);
    setRows((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const months = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(monthKey(r.expense_date)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const vehicles = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.vehicles) m.set(r.vehicles.id, r.vehicles.name); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab === "draft" && r.status !== "draft") return false;
      if (tab === "with_booking" && !r.booking_id) return false;
      if (tab === "general" && r.booking_id) return false;
      if (month !== "all" && monthKey(r.expense_date) !== month) return false;
      if (vehicleFilter !== "all" && r.vehicle_id !== vehicleFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.supplier || ""} ${r.description || ""} ${r.vehicles?.name || ""} ${r.vehicles?.license_plate || ""} ${r.bookings?.booking_number || ""} ${r.bookings?.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, month, vehicleFilter, typeFilter, search]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
    const byType: Record<string, number> = {};
    filtered.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + Number(r.amount); });
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    const drafts = filtered.filter((r) => r.status === "draft").length;
    return { total, count: filtered.length, topType, drafts };
  }, [filtered]);

  const openReceipt = async (row: Row) => {
    if (!row.receipt_url) return;
    if (receiptUrls[row.id]) {
      window.open(receiptUrls[row.id], "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(row.receipt_url, 300);
    if (error || !data) return toast({ title: "Erro ao abrir comprovante", variant: "destructive" });
    setReceiptUrls((s) => ({ ...s, [row.id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank");
  };

  const approve = async (id: string) => {
    const { error } = await supabase.from("vehicle_expenses").update({ status: "approved" }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Custo aprovado" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    const { error } = await supabase.from("vehicle_expenses").delete().eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Custo removido" });
    load();
  };

  const exportCsv = () => {
    const csvRows = [
      ["Data", "Veículo", "Placa", "Tipo", "Fornecedor", "Descrição", "Valor", "Reserva", "Cliente", "Origem", "Status"],
      ...filtered.map((r) => [
        r.expense_date,
        r.vehicles?.name || "",
        r.vehicles?.license_plate || "",
        TYPE_LABEL[r.type] || r.type,
        r.supplier || "",
        r.description || "",
        Number(r.amount).toFixed(2),
        r.bookings?.booking_number || "",
        formatPersonName(r.bookings?.customer_name) || "",
        r.source === "ai_receipt" ? "IA" : "Manual",
        r.status,
      ]),
    ];
    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="admin-h1 text-2xl flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Central de Custos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre todo custo por veículo — manutenção, combustível, lavagem, peças e mais. Atrele à reserva quando fizer sentido.
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo custo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/40"><CardContent className="py-5 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total (filtro)</p>
          <p className="admin-kpi text-2xl tabular-nums">${kpis.total.toFixed(2)}</p>
          <p className="text-[11px] text-muted-foreground">{kpis.count} lançamentos</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="py-5 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Maior categoria</p>
          <p className="admin-kpi text-2xl tabular-nums">{kpis.topType ? `$${kpis.topType[1].toFixed(2)}` : "—"}</p>
          <p className="text-[11px] text-muted-foreground">{kpis.topType ? TYPE_LABEL[kpis.topType[0]] : ""}</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="py-5 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket médio</p>
          <p className="admin-kpi text-2xl tabular-nums">${kpis.count ? (kpis.total / kpis.count).toFixed(2) : "0.00"}</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="py-5 text-center space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rascunhos IA</p>
          <p className="admin-kpi text-2xl tabular-nums text-amber-600 dark:text-amber-400">{kpis.drafts}</p>
          <p className="text-[11px] text-muted-foreground">aguardando aprovação</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar fornecedor, descrição, veículo..." className="h-9 w-72 pl-8 text-xs" />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="h-9 w-[220px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicles.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Rascunhos IA</TabsTrigger>
          <TabsTrigger value="with_booking">Com reserva</TabsTrigger>
          <TabsTrigger value="general">Custos gerais</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <Card className="border-border/40"><CardContent>
              <EmptyState compact icon={Wallet} title="Nenhum custo encontrado" description="Clique em Novo custo para registrar o primeiro lançamento." />
            </CardContent></Card>
          ) : (
            <Card className="border-border/40"><CardContent className="p-0">
              <div className="overflow-auto max-h-[700px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Data</th>
                      <th className="px-3 py-2 font-medium">Veículo</th>
                      <th className="px-3 py-2 font-medium">Tipo / Fornecedor</th>
                      <th className="px-3 py-2 font-medium">Reserva</th>
                      <th className="px-3 py-2 font-medium text-right">Valor</th>
                      <th className="px-3 py-2 font-medium text-center">Origem</th>
                      <th className="px-3 py-2 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">{new Date(r.expense_date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2">
                          {r.vehicles ? (
                            <button onClick={() => navigate(`/admin/vehicles/${r.vehicles!.id}`)} className="text-left hover:underline">
                              <div className="font-medium">{r.vehicles.name}</div>
                              {r.vehicles.license_plate && <div className="text-[10px] text-muted-foreground">{r.vehicles.license_plate}</div>}
                            </button>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{TYPE_LABEL[r.type] || r.type}</div>
                          {(r.supplier || r.description) && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                              {[r.supplier, r.description].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.booking_id && r.bookings ? (
                            <button onClick={() => navigate(`/admin/bookings/${r.booking_id}`)} className="text-left hover:underline">
                              <div className="inline-flex items-center gap-1 text-primary font-medium">
                                {r.bookings.booking_number || "reserva"} <ExternalLink className="h-3 w-3" />
                              </div>
                              <div className="text-[10px] text-muted-foreground">{formatPersonName(r.bookings.customer_name)}</div>
                            </button>
                          ) : <Badge variant="outline" className="text-[10px]">Custo geral</Badge>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">${Number(r.amount).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          {r.source === "ai_receipt" ? (
                            <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> IA</Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Manual</span>
                          )}
                          {r.status === "draft" && <div><Badge variant="outline" className="mt-1 text-[10px] text-amber-600 border-amber-500/40">Rascunho</Badge></div>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            {r.receipt_url && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openReceipt(r)} title="Ver comprovante">
                                <Paperclip className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {r.status === "draft" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => approve(r.id)} title="Aprovar">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)} title="Excluir">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      <ExpenseFormSheet open={openForm} onOpenChange={setOpenForm} onSaved={load} />
    </div>
  );
}
