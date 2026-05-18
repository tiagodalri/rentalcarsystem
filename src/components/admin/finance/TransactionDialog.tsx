import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Category = { id: string; name: string; type: string; color: string | null };
type Account = { id: string; name: string; type: string };
type Vehicle = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType: "income" | "expense";
  editing?: any | null;
  onSaved: () => void;
}

export function TransactionDialog({ open, onOpenChange, defaultType, editing, onSaved }: Props) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Quick create
  const [newCatName, setNewCatName] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<"bank" | "card" | "cash" | "wallet">("bank");
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewAcc, setShowNewAcc] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(editing?.type || defaultType);
    setAmount(editing ? String(editing.amount) : "");
    setDate(editing?.transaction_date ? new Date(editing.transaction_date + "T00:00:00") : new Date());
    setCategoryId(editing?.category_id || "");
    setAccountId(editing?.account_id || "");
    setDescription(editing?.description || "");
    setVehicleId(editing?.vehicle_id || "");
    setNotes(editing?.notes || "");
    loadOptions();
  }, [open, editing, defaultType]);

  const loadOptions = async () => {
    const [c, a, v] = await Promise.all([
      supabase.from("financial_categories").select("id, name, type, color").eq("is_active", true).order("sort_order"),
      supabase.from("financial_accounts").select("id, name, type").eq("is_active", true).order("name"),
      supabase.from("vehicles").select("id, name").order("name"),
    ]);
    setCategories((c.data as Category[]) || []);
    setAccounts((a.data as Account[]) || []);
    setVehicles((v.data as Vehicle[]) || []);
  };

  const filteredCats = categories.filter((c) => c.type === type);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Descrição obrigatória", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      type,
      amount: amt,
      description: description.trim(),
      transaction_date: format(date, "yyyy-MM-dd"),
      category_id: categoryId || null,
      account_id: accountId || null,
      vehicle_id: vehicleId || null,
      notes: notes.trim() || null,
      source: "manual" as const,
    };
    const { error } = editing
      ? await supabase.from("financial_transactions").update(payload).eq("id", editing.id)
      : await supabase.from("financial_transactions").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Lançamento atualizado" : "Lançamento criado" });
    onSaved();
    onOpenChange(false);
  };

  const createCategoryInline = async () => {
    if (!newCatName.trim()) return;
    const { data, error } = await supabase
      .from("financial_categories")
      .insert({ name: newCatName.trim(), type, sort_order: 99 })
      .select("id, name, type, color")
      .single();
    if (error || !data) {
      toast({ title: "Erro ao criar categoria", description: error?.message, variant: "destructive" });
      return;
    }
    setCategories((prev) => [...prev, data as Category]);
    setCategoryId(data.id);
    setNewCatName("");
    setShowNewCat(false);
  };

  const createAccountInline = async () => {
    if (!newAccName.trim()) return;
    const { data, error } = await supabase
      .from("financial_accounts")
      .insert({ name: newAccName.trim(), type: newAccType })
      .select("id, name, type")
      .single();
    if (error || !data) {
      toast({ title: "Erro ao criar conta", description: error?.message, variant: "destructive" });
      return;
    }
    setAccounts((prev) => [...prev, data as Account]);
    setAccountId(data.id);
    setNewAccName("");
    setShowNewAcc(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border-2 py-2.5 text-sm font-semibold transition-colors",
                type === "income"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <TrendingUp size={16} /> Receita
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border-2 py-2.5 text-sm font-semibold transition-colors",
                type === "expense"
                  ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <TrendingDown size={16} /> Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label className="text-xs">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon size={14} className="mr-2" />
                    {format(date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Pagamento freelancer" />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Categoria</Label>
              <button type="button" onClick={() => setShowNewCat((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus size={10} /> {showNewCat ? "Cancelar" : "Nova"}
              </button>
            </div>
            {showNewCat ? (
              <div className="flex gap-2">
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome da categoria" />
                <Button type="button" size="sm" onClick={createCategoryInline}>Criar</Button>
              </div>
            ) : (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.color || "#6b7280" }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Account */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Conta</Label>
              <button type="button" onClick={() => setShowNewAcc((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus size={10} /> {showNewAcc ? "Cancelar" : "Nova"}
              </button>
            </div>
            {showNewAcc ? (
              <div className="flex gap-2">
                <Input value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Nome da conta" />
                <Select value={newAccType} onValueChange={(v: any) => setNewAccType(v)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Banco</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="wallet">Carteira</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={createAccountInline}>Criar</Button>
              </div>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs">Veículo vinculado (opcional)</Label>
            <Select value={vehicleId || "none"} onValueChange={(v) => setVehicleId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (geral)</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            {editing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
