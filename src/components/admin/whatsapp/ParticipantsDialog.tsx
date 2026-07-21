import { useEffect, useState, useCallback } from "react";
import { UserPlus, X, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { formatPersonName } from "@/lib/formatName";
import { useAssignableStaff } from "@/hooks/useAssignableStaff";

interface Props {
  conversationId: string;
}

interface Participant {
  id: string;
  user_id: string;
  role: string;
  added_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as any;

export function ParticipantsDialog({ conversationId }: Props) {
  const { staff } = useAssignableStaff();
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await anyClient
      .from("conversation_participants")
      .select("id,user_id,role,added_at")
      .eq("conversation_id", conversationId)
      .order("added_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar participantes");
      return;
    }
    setParticipants((data ?? []) as Participant[]);
  }, [conversationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function addParticipant(userId: string) {
    if (participants.some((p) => p.user_id === userId)) {
      toast.info("Já é participante");
      return;
    }
    setBusy(userId);
    const { error } = await anyClient.from("conversation_participants").insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "watcher",
    });
    setBusy(null);
    if (error) {
      toast.error("Falha ao adicionar", { description: error.message });
      return;
    }
    toast.success("Participante adicionado");
    setAddOpen(false);
    load();
  }

  async function removeParticipant(id: string) {
    setBusy(id);
    const { error } = await anyClient
      .from("conversation_participants")
      .delete()
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Não foi possível remover", {
        description:
          "Apenas administradores podem remover participantes. " + (error.message ?? ""),
      });
      return;
    }
    toast.success("Removido");
    load();
  }

  const staffById = new Map(staff.map((s) => [s.user_id, s]));
  const available = staff.filter((s) => !participants.some((p) => p.user_id === s.user_id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Participantes">
          <Users className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Participantes da conversa</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <ScrollArea className="max-h-72 -mx-2 px-2">
            {loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : participants.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum participante adicional
              </div>
            ) : (
              <ul className="space-y-1">
                {participants.map((p) => {
                  const s = staffById.get(p.user_id);
                  const label = s
                    ? formatPersonName(s.full_name) || s.email || p.user_id.slice(0, 8)
                    : p.user_id.slice(0, 8);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted"
                    >
                      <PersonAvatar name={s?.full_name || s?.email || "?"} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{label}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {p.role}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeParticipant(p.id)}
                        disabled={busy === p.id}
                        title="Remover"
                      >
                        {busy === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>

          <div className="pt-2 border-t">
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <UserPlus className="w-4 h-4" />
                  Adicionar participante
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <ScrollArea className="max-h-72">
                  {available.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      Todos os atendentes já foram adicionados
                    </div>
                  ) : (
                    <ul className="p-1">
                      {available.map((s) => (
                        <li key={s.user_id}>
                          <button
                            type="button"
                            onClick={() => addParticipant(s.user_id)}
                            disabled={busy === s.user_id}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                          >
                            <PersonAvatar name={s.full_name || s.email || "?"} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {formatPersonName(s.full_name) || s.email}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {s.role}
                              </div>
                            </div>
                            {busy === s.user_id && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
