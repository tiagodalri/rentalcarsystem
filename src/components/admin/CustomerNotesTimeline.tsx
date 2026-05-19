import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquarePlus, User, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Note = {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
};

interface Props {
  customerId: string;
}

export function CustomerNotesTimeline({ customerId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customer_notes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    setNotes((data as Note[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [customerId]);

  const add = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const authorId = u.user?.id || null;
    let authorName: string | null = u.user?.email || null;
    if (authorId) {
      const { data: tm } = await supabase.from("team_members").select("full_name").eq("user_id", authorId).maybeSingle();
      if (tm?.full_name) authorName = tm.full_name;
    }
    const { error } = await supabase.from("customer_notes").insert({
      customer_id: customerId,
      body: body.trim(),
      author_id: authorId,
      author_name: authorName,
    });
    if (error) {
      toast({ title: "Erro ao adicionar nota", description: error.message, variant: "destructive" });
    } else {
      setBody("");
      load();
    }
    setSubmitting(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta anotação?")) return;
    await supabase.from("customer_notes").delete().eq("id", id);
    setNotes(notes.filter(n => n.id !== id));
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded-xl border border-border/30 bg-card/40 p-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Adicionar anotação sobre este cliente..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={add}
            disabled={!body.trim() || submitting}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md gold-gradient text-primary-foreground text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <MessageSquarePlus size={12} />}
            Adicionar nota
          </button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma anotação ainda.</div>
      ) : (
        <div className="relative pl-6 space-y-3 before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border/40">
          {notes.map((n) => (
            <div key={n.id} className="relative group">
              <span className="absolute -left-[18px] top-2.5 w-2.5 h-2.5 rounded-full bg-primary/80 ring-4 ring-background" />
              <div className="rounded-lg border border-border/30 bg-card/60 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User size={10} />
                    <span className="font-medium text-foreground">{n.author_name || "Sistema"}</span>
                    <span>•</span>
                    <span>{fmtDate(n.created_at)}</span>
                  </div>
                  <button
                    onClick={() => remove(n.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
