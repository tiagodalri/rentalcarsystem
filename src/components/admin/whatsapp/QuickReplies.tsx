import { useMemo, useRef, useState } from "react";
import { Zap, Plus, Pencil, Trash2, Loader2, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useWhatsAppQuickReplies,
  QUICK_REPLY_CATEGORIES,
  type QuickReply,
} from "@/hooks/useWhatsAppQuickReplies";
import { uploadWhatsAppMedia } from "@/lib/whatsappMedia";

const ALL = "todas";

export function QuickReplyMenu({
  onUseQuickReply,
}: {
  onUseQuickReply: (reply: QuickReply) => void;
}) {
  const { replies, loading, create, update, remove } = useWhatsAppQuickReplies();
  const [manageOpen, setManageOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [tab, setTab] = useState<"texto" | "midia">("texto");
  const [filter, setFilter] = useState<string>(ALL);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    shortcut: string;
    content: string;
    category: string;
    media_url: string | null;
    media_mimetype: string | null;
    media_name: string | null;
  }>({
    title: "",
    shortcut: "",
    content: "",
    category: "geral",
    media_url: null,
    media_mimetype: null,
    media_name: null,
  });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (filter === ALL) return replies;
    return replies.filter((r) => (r.category ?? "geral") === filter);
  }, [replies, filter]);

  function openNew() {
    setEditing(null);
    setTab("texto");
    setForm({
      title: "",
      shortcut: "",
      content: "",
      category: "geral",
      media_url: null,
      media_mimetype: null,
      media_name: null,
    });
    setManageOpen(true);
    setPopoverOpen(false);
  }
  function openEdit(r: QuickReply) {
    setEditing(r);
    setTab(r.media_url ? "midia" : "texto");
    setForm({
      title: r.title,
      shortcut: r.shortcut ?? "",
      content: r.content ?? "",
      category: r.category ?? "geral",
      media_url: r.media_url,
      media_mimetype: r.media_mimetype,
      media_name: r.media_url ? r.media_url.split("/").pop() ?? "mídia" : null,
    });
    setManageOpen(true);
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo acima de 20 MB");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadWhatsAppMedia(file);
      setForm((f) => ({
        ...f,
        media_url: uploaded.signedUrl,
        media_mimetype: uploaded.mimeType,
        media_name: uploaded.fileName,
      }));
    } catch (e) {
      console.error("[wa] quick reply upload failed", e);
      toast.error("Falha no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save() {
    if (!form.title.trim()) return;
    const isMedia = tab === "midia";
    if (isMedia && !form.media_url) {
      toast.error("Anexe um arquivo antes de salvar");
      return;
    }
    if (!isMedia && !form.content.trim()) {
      toast.error("Escreva o conteúdo do atalho");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      shortcut: form.shortcut.trim() || null,
      category: form.category || "geral",
      content: isMedia ? (form.content ?? "") : form.content,
      media_url: isMedia ? form.media_url : null,
      media_mimetype: isMedia ? form.media_mimetype : null,
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
        <PopoverContent align="start" side="top" className="w-96 p-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Respostas rápidas</span>
            <Button size="sm" variant="ghost" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
          <div className="px-3 py-2 border-b flex flex-wrap gap-1.5">
            {[ALL, ...QUICK_REPLY_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border transition",
                  filter === c
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-transparent border-border text-muted-foreground hover:bg-muted/60",
                )}
              >
                {c === ALL ? "Todas" : c}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma resposta rápida nessa categoria.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((r) => (
                  <li key={r.id} className="group flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => { onUseQuickReply(r); setPopoverOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        {r.media_url && <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium truncate">{r.title}</span>
                        {r.shortcut && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">{r.shortcut}</span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {r.usage_count ?? 0}x
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.media_url ? (r.content?.trim() || "Mídia sem legenda") : r.content}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {r.category ?? "geral"}
                      </div>
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
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={openNew}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Título</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium">Categoria</label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUICK_REPLY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Atalho (opcional)</label>
              <Input
                value={form.shortcut}
                onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                placeholder="/oi"
              />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "texto" | "midia")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="texto">Texto</TabsTrigger>
                <TabsTrigger value="midia">Mídia</TabsTrigger>
              </TabsList>
              <TabsContent value="texto" className="pt-3">
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
              </TabsContent>
              <TabsContent value="midia" className="pt-3 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {form.media_url ? "Trocar arquivo" : "Selecionar arquivo"}
                </Button>
                {form.media_url && (
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="truncate">{form.media_name}</span>
                    <span className="text-[10px]">({form.media_mimetype})</span>
                  </div>
                )}
                <label className="text-xs font-medium block pt-1">Legenda (opcional)</label>
                <Textarea
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Legenda enviada junto com a mídia"
                />
              </TabsContent>
            </Tabs>

            {editing && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {editing.usage_count ?? 0}x usado
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
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
