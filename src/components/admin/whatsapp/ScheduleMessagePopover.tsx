import { useState, useMemo } from "react";
import { Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  conversationId: string;
  draft: string;
  onScheduled: () => void;
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/** Format a Date as the value expected by <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextMonday9h(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 1 ? 7 : (1 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function ScheduleMessagePopover({ conversationId, draft, onScheduled }: Props) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState<string>(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [saving, setSaving] = useState(false);

  const disabledSend = useMemo(() => {
    if (!draft.trim() || !when) return true;
    const t = new Date(when).getTime();
    return !Number.isFinite(t) || t <= Date.now();
  }, [draft, when]);

  function applyShortcut(kind: "plus1h" | "tomorrow9" | "monday9") {
    const now = new Date();
    let d: Date;
    if (kind === "plus1h") d = new Date(now.getTime() + 60 * 60 * 1000);
    else if (kind === "tomorrow9") {
      d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else d = nextMonday9h(now);
    setWhen(toLocalInput(d));
  }

  async function handleSchedule() {
    if (disabledSend) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;
      const scheduledFor = new Date(when).toISOString();
      const { error } = await supabase.from("scheduled_messages").insert({
        conversation_id: conversationId,
        content: draft.trim(),
        message_type: "text",
        scheduled_for: scheduledFor,
        status: "pending",
        created_by: userId,
      });
      if (error) throw error;
      toast.success("Mensagem agendada", {
        description: format(new Date(when), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }),
      });
      onScheduled();
      setOpen(false);
    } catch (err) {
      console.error("[schedule] failed", err);
      toast.error("Falha ao agendar mensagem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full shrink-0 text-muted-foreground hover:text-primary"
          title="Agendar mensagem"
          disabled={!draft.trim()}
        >
          <Clock className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold">Agendar mensagem</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Será enviada automaticamente no horário escolhido.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => applyShortcut("plus1h")}>+1h</Button>
          <Button type="button" variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => applyShortcut("tomorrow9")}>Amanhã 9h</Button>
          <Button type="button" variant="secondary" size="sm" className="h-7 text-[11px]" onClick={() => applyShortcut("monday9")}>Segunda 9h</Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-when" className="text-[11px] uppercase tracking-wider text-muted-foreground">Data e hora</Label>
          <Input
            id="schedule-when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {draft.trim() && (
          <div className="rounded-md bg-muted/40 border border-border/40 px-2.5 py-2 text-xs text-muted-foreground max-h-24 overflow-hidden">
            <div className="line-clamp-3">{draft}</div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSchedule} disabled={disabledSend || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Clock className="w-4 h-4 mr-1.5" />}
            Agendar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
