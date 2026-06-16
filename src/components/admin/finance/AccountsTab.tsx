import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Loader2, Landmark, CreditCard, Wallet, Banknote } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Account = {
  id: string;
  name: string;
  type: "bank" | "card" | "cash" | "wallet";
  initial_balance: number;
  currency: string;
  is_active: boolean;
};

const TYPE_META: Record<Account["type"], { label: string; icon: any; color: string }> = {
  bank: { label: "Banco", icon: Landmark, color: "text-blue-500" },
  card: { label: "Cartão", icon: CreditCard, color: "text-purple-500" },
  cash: { label: "Dinheiro", icon: Banknote, color: "text-emerald-500" },
  wallet: { label: "Carteira", icon: Wallet, color: "text-amber-500" },
};

export function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("financial_accounts").select("*").order("name");
    setAccounts((data as Account[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (a: Account) => {
    await supabase.from("financial_accounts").update({ is_active: !a.is_active }).eq("id", a.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">Contas</h2>
          <p className="text-xs text-muted-foreground">Origens do dinheiro (bancos, cartões, caixa)</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} className="mr-1" /> Nova Conta
        </Button>
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => {
            const meta = TYPE_META[a.type];
            const Icon = meta.icon;
            return (
              <Card key={a.id} className="border-border/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${meta.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setDialogOpen(true); }} className="h-7 w-7" aria-label="Editar conta">
                        <Pencil size={12} />
                      </Button>
                    </div>
                  </div>
                  <p className={`text-base font-semibold ${!a.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}>{a.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{meta.label}</p>
                  <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                    Saldo inicial: <span className="font-medium text-foreground">{a.currency} {Number(a.initial_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />
    </div>
  );
}

function AccountDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Account | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("bank");
  const [initialBalance, setInitialBalance] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || "");
    setType(editing?.type || "bank");
    setInitialBalance(editing ? String(editing.initial_balance) : "0");
    setCurrency(editing?.currency || "USD");
  }, [open, editing]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { name: name.trim(), type, initial_balance: parseFloat(initialBalance) || 0, currency };
    const { error } = editing
      ? await supabase.from("financial_accounts").update(payload).eq("id", editing.id)
      : await supabase.from("financial_accounts").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Atualizada" : "Criada" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cartão Nubank" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="wallet">Carteira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Saldo inicial</Label>
            <Input type="number" step="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={12} className="mr-1 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
