import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Tag, Check, Trash2, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { LoadingInline } from "@/components/skeletons/LoadingRows";
import { toast } from "@/hooks/use-toast";

type CustomerTag = { id: string; name: string; color: string; description: string | null };

const COLOR_MAP: Record<string, string> = {
  gold: "bg-primary/15 text-primary border-primary/30",
  emerald: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  blue: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  red: "bg-red-500/15 text-red-500 border-red-500/30",
  purple: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const COLOR_OPTIONS = ["gold", "emerald", "blue", "amber", "red", "purple", "slate"];

export function colorClass(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.slate;
}

interface Props {
  customerId: string;
  compact?: boolean;
}

export function CustomerTagsManager({ customerId, compact = false }: Props) {
  const [allTags, setAllTags] = useState<CustomerTag[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gold");

  const load = async () => {
    setLoading(true);
    const [t, a] = await Promise.all([
      supabase.from("customer_tags").select("*").order("sort_order"),
      supabase.from("customer_tag_assignments").select("tag_id").eq("customer_id", customerId),
    ]);
    setAllTags((t.data as CustomerTag[]) || []);
    setAssigned((a.data || []).map((r: any) => r.tag_id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerId]);

  const toggle = async (tagId: string) => {
    if (assigned.includes(tagId)) {
      await supabase.from("customer_tag_assignments").delete().eq("customer_id", customerId).eq("tag_id", tagId);
      setAssigned(assigned.filter(id => id !== tagId));
    } else {
      await supabase.from("customer_tag_assignments").insert({ customer_id: customerId, tag_id: tagId });
      setAssigned([...assigned, tagId]);
    }
  };

  const createTag = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("customer_tags").insert({
      name: newName.trim(),
      color: newColor,
      sort_order: allTags.length + 1,
    }).select().single();
    if (error) {
      toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      setAllTags([...allTags, data as CustomerTag]);
      await supabase.from("customer_tag_assignments").insert({ customer_id: customerId, tag_id: data.id });
      setAssigned([...assigned, data.id]);
    }
    setNewName("");
    setCreating(false);
  };

  const deleteTag = async (id: string) => {
    if (!confirm("Excluir esta tag de todos os clientes?")) return;
    await supabase.from("customer_tags").delete().eq("id", id);
    setAllTags(allTags.filter(t => t.id !== id));
    setAssigned(assigned.filter(a => a !== id));
  };

  const assignedTags = allTags.filter(t => assigned.includes(t.id));

  if (loading) return <LoadingInline />;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "min-h-[28px]"}`}>
      {assignedTags.map(tag => (
        <span
          key={tag.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colorClass(tag.color)}`}
        >
          {tag.name}
          {!compact && (
            <button onClick={() => toggle(tag.id)} className="hover:opacity-70">
              <X size={9} />
            </button>
          )}
        </span>
      ))}

      {!compact && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
              <Plus size={10} /> Tag
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allTags.map(tag => {
                const active = assigned.includes(tag.id);
                return (
                  <div key={tag.id} className="flex items-center gap-1.5 group">
                    <button
                      onClick={() => toggle(tag.id)}
                      className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 ${active ? "bg-muted/40" : ""}`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${colorClass(tag.color).split(" ")[0]}`} />
                      <span className="flex-1 text-left text-foreground">{tag.name}</span>
                      {active && <Check size={12} className="text-primary" />}
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-border/30">
              {creating ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTag()}
                    placeholder="Nome da nova tag"
                    className="w-full h-8 px-2 rounded-md border border-border/40 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <div className="flex items-center gap-1">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`w-5 h-5 rounded-full border-2 ${colorClass(c).split(" ")[0]} ${newColor === c ? "border-foreground" : "border-transparent"}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={createTag} className="flex-1 h-7 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">Criar</button>
                    <button onClick={() => { setCreating(false); setNewName(""); }} className="h-7 px-2 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-border/40 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                  <Plus size={11} /> Criar nova tag
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function CustomerTagsInline({ customerId }: { customerId: string }) {
  const [tags, setTags] = useState<{ name: string; color: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customer_tag_assignments")
        .select("customer_tags(name, color)")
        .eq("customer_id", customerId);
      setTags((data || []).map((r: any) => r.customer_tags).filter(Boolean));
    })();
  }, [customerId]);
  if (tags.length === 0) return <span className="text-[10px] text-muted-foreground/40"></span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t, i) => (
        <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${colorClass(t.color)}`}>
          {t.name}
        </span>
      ))}
    </div>
  );
}
