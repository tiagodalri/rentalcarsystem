import { Star, AlertTriangle, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  updateConversationFlags,
  type WhatsAppConversation,
} from "@/hooks/useWhatsAppConversations";

/**
 * Compact toggle controls for VIP, Urgent, and Archive flags on a conversation.
 * Renders three icon buttons; state is optimistic via realtime refresh.
 */
export function ConversationFlagsControls({
  conversation,
}: {
  conversation: WhatsAppConversation;
}) {
  async function toggle(field: "is_vip" | "is_urgent") {
    const next = !conversation[field];
    try {
      await updateConversationFlags(conversation.id, { [field]: next });
      toast.success(
        field === "is_vip"
          ? next ? "Marcada como VIP" : "VIP removido"
          : next ? "Marcada como urgente" : "Urgência removida",
      );
    } catch {
      toast.error("Falha ao atualizar");
    }
  }

  async function toggleArchive() {
    const next = conversation.status === "archived" ? "open" : "archived";
    try {
      await updateConversationFlags(conversation.id, { status: next });
      toast.success(next === "archived" ? "Conversa arquivada" : "Conversa restaurada");
    } catch {
      toast.error("Falha ao arquivar");
    }
  }

  const archived = conversation.status === "archived";

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => toggle("is_vip")}
        title={conversation.is_vip ? "Remover VIP" : "Marcar como VIP"}
      >
        <Star
          className={cn(
            "w-4 h-4 transition-colors",
            conversation.is_vip ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => toggle("is_urgent")}
        title={conversation.is_urgent ? "Remover urgência" : "Marcar como urgente"}
      >
        <AlertTriangle
          className={cn(
            "w-4 h-4 transition-colors",
            conversation.is_urgent ? "fill-red-500/20 text-red-600" : "text-muted-foreground",
          )}
        />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={toggleArchive}
        title={archived ? "Restaurar conversa" : "Arquivar conversa"}
      >
        {archived ? (
          <ArchiveRestore className="w-4 h-4 text-primary" />
        ) : (
          <Archive className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
