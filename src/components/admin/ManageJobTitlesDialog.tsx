import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Check, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useJobTitles, type JobTitle } from "@/hooks/useJobTitles";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManageJobTitlesDialog({ open, onOpenChange }: Props) {
  const { refresh } = useJobTitles();
  const [items, setItems] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("job_titles").select("*").order("sort_order").order("name");
    setItems((data || []) as JobTitle[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error } = await supabase.from("job_titles").insert({
      name, description: newDesc.trim() || null, sort_order: maxOrder + 1,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cargo criado" });
    setNewName(""); setNewDesc(""); setAdding(false);
    await load(); await refresh();
  };

  const startEdit = (jt: JobTitle) => {
    setEditingId(jt.id); setEditName(jt.name); setEditDesc(jt.description || "");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("job_titles")
      .update({ name: editName.trim(), description: editDesc.trim() || null })
      .eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEditingId(null);
    await load(); await refresh();
  };

  const toggleActive = async (jt: JobTitle) => {
    await supabase.from("job_titles").update({ is_active: !jt.is_active }).eq("id", jt.id);
    await load(); await refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const a = items[idx]; const b = items[idx + dir];
    if (!a || !b) return;
    await supabase.from("job_titles").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("job_titles").update({ sort_order: a.sort_order }).eq("id", b.id);
    await load(); await refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar cargos</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {items.map((jt, idx) => (
                <div key={jt.id} className={`flex items-start gap-2 p-3 rounded-lg border border-border/40 ${!jt.is_active ? "opacity-50" : ""}`}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp size={12} />
                    </button>
                    <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === jt.id ? (
                      <div className="space-y-2">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-8" />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">{jt.name}</p>
                        {jt.description && <p className="text-xs text-muted-foreground">{jt.description}</p>}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={jt.is_active} onCheckedChange={() => toggleActive(jt)} />
                    {editingId === jt.id ? (
                      <>
                        <button onClick={() => saveEdit(jt.id)} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-500/10"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-muted-foreground hover:bg-muted"><X size={14} /></button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(jt)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do cargo *" className="h-9" />
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-9" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); setNewDesc(""); }}>Cancelar</Button>
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Adicionar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
              <Plus className="h-3.5 w-3.5" /> Adicionar cargo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
