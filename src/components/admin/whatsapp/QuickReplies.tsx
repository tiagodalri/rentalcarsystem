import { useState } from "react";
import { Zap, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWhatsAppQuickReplies, type QuickReply } from "@/hooks/useWhatsAppQuickReplies";

export function QuickReplyMenu({
  onInsert,
}: {
  onInsert: (content: string) => void;
}) {
  const { replies, loading, create, update, remove } = useWhatsAppQuickReplies();
  const [manageOpen, setManageOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [form, setForm] = useState<{ title: string; shortcut: string; content: string }>({
    title: "", shortcut: "", content: "",
  });
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ title: "", shortcut: "", content: "" });
    setManageOpen(true);
    setPopoverOpen(false);
  }
  function openEdit(r: QuickReply) {
    setEditing(r);
    setForm({ title: r.title, shortcut: r.shortcut ?? "", content: r.content });
    setManageOpen(true);
  }
  async function save() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      shortcut: form.shortcut.trim() || undefined,
      content: form.content,
    };
    const res = editing ? await update(editing.id, payload) : await create(payload);
    setSaving(false);
    if (res.error) return toast.error("Falha ao salvar");
    toast.success(editing ? "Atualizado" : "Criado");
    setManageOpen(false);
    setEditing(null);
  }
  async function del(r: QuickReply) {
    if (!confirm(`Excluir "${r.title}"?`)) return;
    await remove(r.id);
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Respostas rápidas">
            <Zap className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-80 p-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Respostas rápidas</span>
            <Button size="sm" variant="ghost" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : replies.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma resposta rápida. Crie a primeira.
              </div>
            ) : (
              <ul className="divide-y">
                {replies.map((r) => (
                  <li key={r.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => { onInsert(r.content); setPopoverOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{r.title}</span>
                        {r.shortcut && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">{r.shortcut}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{r.content}</div>
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del(r)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setManageOpen(true); setEditing(null); setPopoverOpen(false); }}>
              Gerenciar atalhos
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar atalho" : "Nova resposta rápida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Título</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Atalho (opcional)</label>
              <Input
                value={form.shortcut}
                onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                placeholder="/oi"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Conteúdo</label>
              <Textarea
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Olá {{cliente}}, tudo bem?"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Use <code>{"{{cliente}}"}</code> para inserir o nome do contato.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function applyPlaceholders(content: string, contactName?: string | null): string {
  const name = contactName ? contactName.split(" ")[0] : "";
  return content.replace(/\{\{\s*cliente\s*\}\}/gi, name);
}
