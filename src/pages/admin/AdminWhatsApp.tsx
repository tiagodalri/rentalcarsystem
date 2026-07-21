import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  ArrowLeft,
  Info,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import {
  useWhatsAppConversations,
  markConversationRead,
  type WhatsAppConversation,
} from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, type WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import {
  checkWhatsAppStatus,
  isDeviceOffline,
  isNotConfigured,
  sendWhatsAppText,
} from "@/lib/zapi";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { stageInfo, tagClass, STAGE_BADGE_BASE } from "@/components/admin/whatsapp/stage";
import { MessageBubble, DateSeparator, dateLabel } from "@/components/admin/whatsapp/MessageBubble";
import { ContextPanel } from "@/components/admin/whatsapp/ContextPanel";
import { QuickReplyMenu, applyPlaceholders } from "@/components/admin/whatsapp/QuickReplies";
import { EmojiPickerButton } from "@/components/admin/whatsapp/EmojiPickerButton";
import { AttachmentButton } from "@/components/admin/whatsapp/AttachmentButton";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}

/** Small inline status pill for the page header (no big banner). */
function HeaderStatusBadge() {
  const { connection } = useWhatsAppConnection();
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const res = await checkWhatsAppStatus();
      setConfigured(!isNotConfigured(res));
    })();
  }, []);

  const status = connection?.status;
  let label = "Não configurado";
  let dot = "bg-muted-foreground/60";
  let cls = "text-muted-foreground";
  if (configured) {
    if (status === "connected") {
      label = "Conectado";
      dot = "bg-emerald-500";
      cls = "text-emerald-600";
    } else if (status === "connecting") {
      label = "Conectando";
      dot = "bg-amber-500";
      cls = "text-amber-600";
    } else {
      label = "Desconectado";
      dot = "bg-muted-foreground/60";
      cls = "text-muted-foreground";
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 text-[11px] ${cls}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      {connection?.connected_phone && configured && status === "connected" && (
        <span className="text-[11px] text-muted-foreground">
          {formatPhone(connection.connected_phone)}
        </span>
      )}
      {(!configured || status !== "connected") && (
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <Settings2 className="w-3 h-3" />
          Configurar
        </Link>
      )}
    </div>
  );
}


// ---------------- Conversation List (WhatsApp-like) ----------------
function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(q) ||
        c.phone.includes(q.replace(/\D/g, "")) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [conversations, search]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou tag"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa</div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const isActive = c.id === selectedId;
              const displayName = c.contact_name ? formatPersonName(c.contact_name) : formatPhone(c.phone);
              const stage = stageInfo(c.stage);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`w-full flex items-start gap-3 px-3 py-3 border-b border-border/60 text-left transition-colors ${
                      isActive ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <PersonAvatar name={c.contact_name || c.phone} size="lg" tone="gold" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{displayName}</span>
                        {c.last_message_at && (
                          <span className={`text-[10px] shrink-0 ${c.unread_count > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {c.last_message_preview || "—"}
                        </p>
                        {c.unread_count > 0 && (
                          <Badge className="h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] bg-primary text-primary-foreground hover:bg-primary border-0">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <span className={`${STAGE_BADGE_BASE} ${stage.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                          {stage.label}
                        </span>
                        {c.tags.slice(0, 2).map((t) => (
                          <span key={t} className={`${STAGE_BADGE_BASE} ${tagClass(t)}`}>
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{c.tags.length - 2}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

// Group messages by date
function groupByDate(messages: WhatsAppMessage[]) {
  const groups: { label: string; items: WhatsAppMessage[] }[] = [];
  let currentKey = "";
  for (const m of messages) {
    const d = m.timestamp ? new Date(m.timestamp) : new Date(m.created_at);
    const key = d.toDateString();
    if (key !== currentKey) {
      groups.push({ label: dateLabel(d), items: [] });
      currentKey = key;
    }
    groups[groups.length - 1].items.push(m);
  }
  return groups;
}

// ---------------- Message Thread (WhatsApp-like) ----------------
function MessageThread({
  conversation,
  onBack,
  onToggleContext,
  contextOpen,
}: {
  conversation: WhatsAppConversation | null;
  onBack?: () => void;
  onToggleContext: () => void;
  contextOpen: boolean;
}) {
  const { messages, loading } = useWhatsAppMessages(conversation?.id ?? null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (conversation && conversation.unread_count > 0) markConversationRead(conversation.id);
  }, [conversation?.id, conversation?.unread_count]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/20">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-primary/60" />
        </div>
        <h3 className="text-base font-semibold text-foreground/80">WhatsApp GoDalz</h3>
        <p className="text-sm text-muted-foreground max-w-xs mt-2">
          Selecione uma conversa para começar. Todas as trocas ficam sincronizadas com o CRM.
        </p>
      </div>
    );
  }

  const displayName = conversation.contact_name
    ? formatPersonName(conversation.contact_name)
    : formatPhone(conversation.phone);

  async function handleSend() {
    if (!draft.trim() || !conversation) return;
    setSending(true);
    const res = await sendWhatsAppText(conversation.phone, draft.trim(), conversation.id);
    setSending(false);
    if (res.ok && res.simulated) {
      toast.success("Mensagem enviada", {
        description: "Modo demonstração — configure a Z-API em Configurações para envio real.",
      });
      setDraft("");
      return;
    }
    if (!res.ok) {
      if (isNotConfigured(res)) return toast.error("Integração não configurada");
      if (isDeviceOffline(res)) return toast.error("Celular offline — verifique o WhatsApp no aparelho");
      return toast.error("Falha ao enviar");
    }
    setDraft("");
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function insertQuickReply(content: string) {
    const applied = applyPlaceholders(content, conversation?.contact_name);
    setDraft((d) => (d ? d + "\n" + applied : applied));
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const groups = groupByDate(messages);
  const stage = stageInfo(conversation.stage);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-background flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onToggleContext}>
          <PersonAvatar name={conversation.contact_name || conversation.phone} size="md" tone="gold" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{displayName}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{formatPhone(conversation.phone)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                {stage.label}
              </span>
            </div>
          </div>
        </button>
        <Button
          variant={contextOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-9 w-9"
          onClick={onToggleContext}
          title="Contexto"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto wa-chat-bg py-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          groups.map((g, gi) => (
            <div key={gi}>
              <DateSeparator label={g.label} />
              <div className="space-y-1">
                {g.items.map((m) => <MessageBubble key={m.id} m={m} />)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="px-2 py-2 border-t bg-background">
        <div className="flex items-end gap-1">
          <EmojiPickerButton onSelect={insertEmoji} />
          <AttachmentButton phone={conversation.phone} conversationId={conversation.id} />
          <QuickReplyMenu onInsert={insertQuickReply} />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Digite uma mensagem"
            rows={1}
            className="min-h-[40px] max-h-[140px] resize-none rounded-2xl px-4 py-2 bg-muted/40 border-transparent focus-visible:bg-background"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            title="Enviar"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Page ----------------
export default function AdminWhatsApp() {
  const { conversations } = useWhatsAppConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contextOpen, setContextOpen] = useState(false);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div className="-mx-4 -mt-4 lg:-mx-8 lg:-mt-8 -mb-[max(calc(64px+env(safe-area-inset-bottom,0px)+20px),1rem)] lg:-mb-10 h-[calc(100dvh-56px)] lg:h-[calc(100dvh-40px)] flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 md:px-5 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="admin-h1 text-lg md:text-xl truncate">WhatsApp</h1>
          <span className="hidden md:inline text-xs text-muted-foreground truncate">
            Central de conversas · CRM · funil de vendas
          </span>
        </div>
        <HeaderStatusBadge />
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className={`w-full lg:w-[340px] xl:w-[380px] border-r shrink-0 ${selected ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setContextOpen(false); }}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        <div className={`flex-1 min-w-0 ${!selected ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
          <MessageThread
            conversation={selected}
            onBack={() => setSelectedId(null)}
            onToggleContext={() => setContextOpen((v) => !v)}
            contextOpen={contextOpen}
          />
        </div>

        {selected && contextOpen && (
          <div className="hidden lg:flex w-[340px] xl:w-[380px] border-l shrink-0 flex-col min-h-0">
            <ContextPanel conversation={selected} onClose={() => setContextOpen(false)} />
          </div>
        )}
      </div>

      {selected && contextOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setContextOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-background" onClick={(e) => e.stopPropagation()}>
            <ContextPanel conversation={selected} onClose={() => setContextOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
