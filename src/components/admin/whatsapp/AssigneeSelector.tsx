import { useState } from "react";
import { UserPlus, UserMinus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { formatPersonName } from "@/lib/formatName";
import { useAssignableStaff, type StaffMember } from "@/hooks/useAssignableStaff";

interface Props {
  conversationId: string;
  assignedTo: string | null;
  /** compact = avatar-only trigger for the conversation list. */
  variant?: "full" | "compact";
}

function labelOf(s?: StaffMember | null): string {
  if (!s) return "Sem responsável";
  return formatPersonName(s.full_name) || s.email || "—";
}

export function AssigneeSelector({ conversationId, assignedTo, variant = "full" }: Props) {
  const { staff, loading } = useAssignableStaff();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = assignedTo ? staff.find((s) => s.user_id === assignedTo) : null;

  async function assign(userId: string | null) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_conversations")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ assigned_to: userId } as any)
        .eq("id", conversationId);
      if (error) throw error;
      toast.success(userId ? `Delegada a ${labelOf(staff.find((s) => s.user_id === userId))}` : "Sem responsável");
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Falha ao delegar", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        title={current ? `Responsável: ${labelOf(current)}` : "Sem responsável"}
        className="shrink-0 rounded-full ring-1 ring-border/60 hover:ring-primary/60 transition"
      >
        {current ? (
          <PersonAvatar name={current.full_name || current.email || "?"} size="sm" />
        ) : (
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-[9px]">
            <UserPlus className="w-3 h-3" />
          </span>
        )}
      </button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-xs"
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : current ? (
          <PersonAvatar name={current.full_name || current.email || "?"} size="sm" />
        ) : (
          <UserPlus className="w-3.5 h-3.5" />
        )}
        <span className="truncate max-w-[140px]">{labelOf(current)}</span>
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-2 border-b">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
            Delegar conversa
          </div>
        </div>
        <ScrollArea className="max-h-80">
          <ul className="p-1">
            <li>
              <button
                type="button"
                onClick={() => assign(null)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                disabled={saving}
              >
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground">
                  <UserMinus className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 text-sm">Remover responsável</span>
                {!assignedTo && <Check className="w-4 h-4 text-primary" />}
              </button>
            </li>
            {loading && (
              <li className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Carregando atendentes…
              </li>
            )}
            {!loading && staff.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground">Nenhum atendente disponível</li>
            )}
            {staff.map((s) => {
              const active = s.user_id === assignedTo;
              return (
                <li key={s.user_id}>
                  <button
                    type="button"
                    onClick={() => assign(s.user_id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left ${
                      active ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                    disabled={saving}
                  >
                    <PersonAvatar name={s.full_name || s.email || "?"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{labelOf(s)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {s.role}
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
