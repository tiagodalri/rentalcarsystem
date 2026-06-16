import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Plus, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

const ICON_OPTIONS = ["Calendar","Users","Plus","ShoppingCart","CircleDollarSign","Wrench","Fuel","Shield","AlertTriangle","FileText","Cog","Sparkles","UsersRound","Megaphone","MoreHorizontal","Briefcase","Building","CreditCard","Receipt","Gift"];

export function CategoriesTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("income");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("financial_categories").select("*").order("type").order("sort_order");
    setCats((data as Category[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = (type: "income" | "expense") => {
    setEditing(null);
    setDefaultType(type);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setDefaultType(c.type);
    setDialogOpen(true);
  };

  const toggleActive = async (c: Category) => {
    await supabase.from("financial_categories").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const renderColumn = (type: "income" | "expense", title: string, icon: any) => {
    const Icon = icon;
    const items = cats.filter((c) => c.type === type);
    return (
      <Card className="border-border/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Icon size={14} className={type === "income" ? "text-emerald-500" : "text-red-500"} />
              {title} ({items.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => openNew(type)}>
              <Plus size={12} className="mr-1" /> Nova
            </Button>
          </div>
          <div className="space-y-1.5">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color || "#6b7280" }} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${!c.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.name}</p>
                    {c.description && <p className="text-[10px] text-muted-foreground truncate">{c.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-7 w-7" aria-label="Editar categoria">
                    <Pencil size={12} />
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma categoria</p>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">Categorias</h2>
        <p className="text-xs text-muted-foreground">Plano de contas para receitas e despesas</p>
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderColumn("income", "Receitas", TrendingUp)}
          {renderColumn("expense", "Despesas", TrendingDown)}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultType={defaultType}
        nextSortOrder={Math.max(0, ...cats.filter((c) => c.type === defaultType).map((c) => c.sort_order)) + 1}
        onSaved={load}
      />
    </div>
  );
}

function CategoryDialog({ open, onOpenChange, editing, defaultType, nextSortOrder, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Category | null;
  defaultType: "income" | "expense"; nextSortOrder: number; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [icon, setIcon] = useState("MoreHorizontal");
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || "");
    setDescription(editing?.description || "");
    setColor(editing?.color || "#6b7280");
    setIcon(editing?.icon || "MoreHorizontal");
    setType(editing?.type || defaultType);
  }, [open, editing, defaultType]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, color, icon, type, sort_order: editing?.sort_order ?? nextSortOrder };
    const { error } = editing
      ? await supabase.from("financial_categories").update(payload).eq("id", editing.id)
      : await supabase.from("financial_categories").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Atualizada" : "Criada" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Ícone</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
