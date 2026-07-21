import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { formatPersonName } from "@/lib/formatName";
import { Search, Loader2 } from "lucide-react";
import type { WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import type { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppDocument,
} from "@/lib/zapi";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: WhatsAppMessage | null;
  conversations: WhatsAppConversation[];
  excludeConversationId: string | null;
}

export function ForwardDialog({
  open, onOpenChange, message, conversations, excludeConversationId,
}: Props) {
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = conversations.filter((c) => c.id !== excludeConversationId);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(q) ||
        c.phone.includes(q.replace(/\D/g, "")),
    );
  }, [conversations, search, excludeConversationId]);

  async function forwardTo(target: WhatsAppConversation) {
    if (!message) return;
    setSendingId(target.id);
    try {
      const extras = { forwardedFromMessageId: message.id };
      let res;
      if (message.message_type === "image" && message.media_url) {
        res = await sendWhatsAppImage(target.phone, message.media_url, message.content ?? "", target.id, extras);
      } else if (message.message_type === "document" && message.media_url) {
        const ext = (message.media_mimetype?.split("/").pop() || "pdf").slice(0, 5);
        res = await sendWhatsAppDocument(target.phone, message.media_url, ext, message.content ?? "documento", target.id, extras);
      } else if (message.content) {
        res = await sendWhatsAppText(target.phone, message.content, target.id, extras);
      } else {
        toast.error("Mensagem sem conteúdo para encaminhar");
        return;
      }
      if (res.ok) {
        toast.success("Encaminhada");
        onOpenChange(false);
      } else {
        toast.error("Falha ao encaminhar");
      }
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Encaminhar mensagem</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[380px]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa</div>
          ) : (
            <ul className="pb-2">
              {filtered.map((c) => {
                const name = c.contact_name ? formatPersonName(c.contact_name) : c.phone;
                const busy = sendingId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => forwardTo(c)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-60"
                    >
                      <PersonAvatar name={c.contact_name || c.phone} size="md" tone="gold" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.phone}</div>
                      </div>
                      {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
