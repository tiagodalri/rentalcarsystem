import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TrendingUp, TrendingDown, Pencil, Ban, X, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { TransactionDialog } from "./TransactionDialog";
import { LoadingRows } from "@/components/skeletons/LoadingRows";
import { EmptyState } from "@/components/admin/EmptyState";

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
  category_id: string | null;
  account_id: string | null;
  vehicle_id: string | null;
  notes: string | null;
  is_cancelled: boolean;
  source: string;
};
type Category = { id: string; name: string; type: string; color: string | null };
type Account = { id: string; name: string };

type Preset = "today" | "week" | "month" | "next30" | "custom" | "all";

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };

const presetRange = (p: Preset): { from?: Date; to?: Date } => {
  const today = new Date();
  if (p === "today") return { from: startOfDay(today), to: endOfDay(today) };
  if (p === "week") return { from: startOfWeek(today), to: endOfDay(today) };
  if (p === "month") return { from: startOfMonth(today), to: endOfDay(today) };
  if (p === "next30") { const e = new Date(today); e.setDate(e.getDate() + 30); return { from: startOfDay(today), to: endOfDay(e) }; }
  return {};
};

const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TransactionsTab() {
  const [params, setParams] = useSearchParams();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"income" | "expense">("income");
  const [editing, setEditing] = useState<Tx | null>(null);

  const preset = (params.get("range") as Preset) || "month";
  const typeFilter = params.get("type") || "all";
  const categoryFilter = params.get("category") || "all";
  const accountFilter = params.get("account") || "all";
  const customFrom = params.get("from");
  const customTo = params.get("to");

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v == null || v === "" || v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const [t, c, a] = await Promise.all([
      supabase.from("financial_transactions").select("*").order("transaction_date", { ascending: false }).limit(500),
      supabase.from("financial_categories").select("id, name, type, color").order("sort_order"),
      supabase.from("financial_accounts").select("id, name").order("name"),
    ]);
    setTxs((t.data as Tx[]) || []);
    setCategories((c.data as Category[]) || []);
    setAccounts((a.data as Account[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const range = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : undefined,
        to: customTo ? new Date(customTo + "T23:59:59") : undefined,
      };
    }
    if (preset === "all") return {};
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (t.is_cancelled) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
      const td = new Date(t.transaction_date + "T12:00:00");
      if (range.from && td < range.from) return false;
      if (range.to && td > range.to) return false;
      return true;
    });
  }, [txs, typeFilter, categoryFilter, accountFilter, range]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  const openCreate = (type: "income" | "expense") => {
    setEditing(null);
    setDialogType(type);
    setDialogOpen(true);
  };

  const openEdit = (t: Tx) => {
    setEditing(t);
    setDialogType(t.type);
    setDialogOpen(true);
  };

  const cancelTx = async (t: Tx) => {
    if (!confirm("Cancelar este lançamento? Ele permanecerá no histórico mas não somará nos totais.")) return;
    const { error } = await supabase.from("financial_transactions").update({ is_cancelled: true }).eq("id", t.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Lançamento cancelado" });
    load();
  };

  const clearFilters = () => setParams({}, { replace: true });

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Esta semana" },
    { key: "month", label: "Este mês" },
    { key: "next30", label: "Próximos 30 dias" },
    { key: "all", label: "Tudo" },
    { key: "custom", label: "Personalizado" },
  ];

  const hasFilters = preset !== "month" || typeFilter !== "all" || categoryFilter !== "all" || accountFilter !== "all" || customFrom || customTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-foreground">Lançamentos</h2>
          <p className="text-xs text-muted-foreground">Receitas e despesas manuais</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openCreate("income")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <TrendingUp size={14} className="mr-1" /> Nova Receita
          </Button>
          <Button onClick={() => openCreate("expense")} className="bg-red-600 hover:bg-red-700 text-white">
            <TrendingDown size={14} className="mr-1" /> Nova Despesa
          </Button>
        </div>
      </div>

      {/* Period chips */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setParam("range", p.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium border transition-colors",
              preset === p.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="font-normal">
                <CalendarIcon size={12} className="mr-2" />
                De: {customFrom ? format(new Date(customFrom + "T00:00:00"), "dd/MM/yyyy") : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom ? new Date(customFrom + "T00:00:00") : undefined}
                onSelect={(d) => setParam("from", d ? format(d, "yyyy-MM-dd") : null)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="font-normal">
                <CalendarIcon size={12} className="mr-2" />
                Até: {customTo ? format(new Date(customTo + "T00:00:00"), "dd/MM/yyyy") : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo ? new Date(customTo + "T00:00:00") : undefined}
                onSelect={(d) => setParam("to", d ? format(d, "yyyy-MM-dd") : null)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={typeFilter} onValueChange={(v) => setParam("type", v)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setParam("category", v)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={(v) => setParam("account", v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={12} className="mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/30"><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receitas</p>
          <p className="text-lg font-medium text-emerald-500 tabular-nums">{fmtUSD(totals.income)}</p>
        </CardContent></Card>
        <Card className="border-border/30"><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Despesas</p>
          <p className="text-lg font-medium text-red-500 tabular-nums">{fmtUSD(totals.expense)}</p>
        </CardContent></Card>
        <Card className="border-border/30"><CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</p>
          <p className={cn("text-lg font-medium tabular-nums", totals.balance >= 0 ? "text-emerald-500" : "text-red-500")}>{fmtUSD(totals.balance)}</p>
        </CardContent></Card>
      </div>

      {/* List */}
      <Card className="border-border/30">
        <CardContent className="p-0">
          {loading ? (
            <LoadingRows count={6} rowHeight={48} className="p-4" />
          ) : filtered.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Nenhum lançamento" description="Crie um lançamento manual usando os botões acima." compact />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const cat = t.category_id ? catMap[t.category_id] : null;
                  const acc = t.account_id ? accMap[t.account_id] : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="tabular-nums text-xs">{format(new Date(t.transaction_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {t.type === "income" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Receita</Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">Despesa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[260px] truncate">{t.description}</TableCell>
                      <TableCell>
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                            {cat.name}
                          </span>
                        ) : <span className="text-xs text-muted-foreground"></span>}
                      </TableCell>
                      <TableCell className="text-xs">{acc?.name || ""}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-semibold", t.type === "income" ? "text-emerald-500" : "text-red-500")}>
                        {t.type === "income" ? "+" : "−"} {fmtUSD(Number(t.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="h-7 w-7" aria-label="Editar lançamento">
                            <Pencil size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => cancelTx(t)} className="h-7 w-7 text-red-500" aria-label="Cancelar lançamento">
                            <Ban size={12} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={dialogType}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
}
