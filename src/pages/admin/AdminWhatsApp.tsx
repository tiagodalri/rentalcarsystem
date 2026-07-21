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
  Pin,
  X,
  WifiOff,
  Mic,
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
import { useMessageReactions } from "@/hooks/useMessageReactions";
import {
  checkWhatsAppStatus,
  isDeviceOffline,
  isNotConfigured,
  sendWhatsAppText,
} from "@/lib/zapi";
import {
  togglePinMessage,
  editMessageContent,
  deleteFailedMessage,
  toggleReaction,
} from "@/lib/whatsappActions";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { stageInfo, tagClass, STAGE_BADGE_BASE } from "@/components/admin/whatsapp/stage";
import {
  MessageBubble,
  DateSeparator,
  dateLabel,
  type MessageBubbleActions,
} from "@/components/admin/whatsapp/MessageBubble";
import { ContextPanel } from "@/components/admin/whatsapp/ContextPanel";
import { QuickReplyMenu, applyPlaceholders } from "@/components/admin/whatsapp/QuickReplies";
import { EmojiPickerButton } from "@/components/admin/whatsapp/EmojiPickerButton";
import { AttachmentButton } from "@/components/admin/whatsapp/AttachmentButton";
import { ForwardDialog } from "@/components/admin/whatsapp/ForwardDialog";
import { AudioRecorderButton } from "@/components/admin/whatsapp/AudioRecorderButton";
import { StickerPicker } from "@/components/admin/whatsapp/StickerPicker";
import { LocationDialog } from "@/components/admin/whatsapp/LocationDialog";
import { ContactShareDialog } from "@/components/admin/whatsapp/ContactShareDialog";
import { TypingDots } from "@/components/admin/whatsapp/TypingDots";
import { useMessageQueue, type QueuedMessage } from "@/hooks/useMessageQueue";
import { usePresenceByPhone, type PresenceStatus } from "@/hooks/usePresenceByPhone";

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
  getPresence,
}: {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  getPresence?: (phone: string) => PresenceStatus;
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
                <li key={c.id} className="relative">
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden />
                  )}
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`w-full flex items-start gap-3 pl-4 pr-5 py-3 border-b border-border/40 text-left transition-colors overflow-hidden ${
                      isActive ? "bg-muted/70" : "hover:bg-muted/40"
                    }`}
                  >
                    <PersonAvatar name={c.contact_name || c.phone} size="lg" tone="gold" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold truncate min-w-0 flex-1">{displayName}</span>
                        {c.last_message_at && (
                          <span className={`text-[10px] shrink-0 tabular-nums ${c.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 min-w-0">
                        {(() => {
                          const presence = getPresence?.(c.phone) ?? null;
                          if (presence) {
                            const label = presence === "recording" ? "gravando áudio" : "digitando";
                            return (
                              <p className="text-xs text-primary truncate min-w-0 flex-1 inline-flex items-center gap-1.5">
                                <span className="italic">{label}</span>
                                <TypingDots dotClassName="bg-primary" />
                              </p>
                            );
                          }
                          return (
                            <p className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                              {c.last_message_preview || "—"}
                            </p>
                          );
                        })()}
                        {c.unread_count > 0 && (
                          <Badge className="h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] bg-primary text-primary-foreground hover:bg-primary border-0 shrink-0">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-2 min-w-0 overflow-hidden">
                        <span className={`${STAGE_BADGE_BASE} ${stage.cls} shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                          {stage.label}
                        </span>
                        {c.tags.slice(0, 1).map((t) => (
                          <span key={t} className={`${STAGE_BADGE_BASE} ${tagClass(t)} shrink-0 truncate max-w-[110px]`}>
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 1 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">+{c.tags.length - 1}</span>
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
  conversations,
  onBack,
  onToggleContext,
  contextOpen,
  connectionStatus,
  configured,
  queueHook,
  presenceStatus,
}: {
  conversation: WhatsAppConversation | null;
  conversations: WhatsAppConversation[];
  onBack?: () => void;
  onToggleContext: () => void;
  contextOpen: boolean;
  connectionStatus: "disconnected" | "connecting" | "connected" | undefined;
  configured: boolean;
  queueHook: ReturnType<typeof useMessageQueue>;
  presenceStatus: PresenceStatus;
}) {
  const { messages, loading } = useWhatsAppMessages(conversation?.id ?? null);
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const { byMessage, currentUserId } = useMessageReactions(conversation?.id ?? null, messageIds);
  const messagesById = useMemo(() => {
    const map = new Map<string, WhatsAppMessage>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);
  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  // ---- Offline queue: merge queued items into the visible thread ----
  const queuedForConv = conversation
    ? queueHook.getQueuedForConversation(conversation.id)
    : [];
  const queuedAsMessages: WhatsAppMessage[] = useMemo(
    () =>
      queuedForConv.map<WhatsAppMessage>((q: QueuedMessage) => ({
        id: q.id,
        conversation_id: q.conversationId,
        external_message_id: null,
        direction: "outbound",
        message_type: "text",
        content: q.text,
        media_url: null,
        media_mimetype: null,
        status:
          q.sendStatus === "failed"
            ? "failed"
            : q.sendStatus === "sent"
            ? "sent"
            : "queued",
        failure_reason: q.errorMessage || null,
        sender_name: null,
        sender_phone: q.phone,
        timestamp: new Date(q.createdAt).toISOString(),
        created_at: new Date(q.createdAt).toISOString(),
        reply_to_message_id: q.replyToMessageId ?? null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queuedForConv)],
  );
  const visibleMessages = useMemo(() => {
    const merged = [...messages, ...queuedAsMessages];
    merged.sort((a, b) => {
      const ta = new Date(a.timestamp || a.created_at).getTime();
      const tb = new Date(b.timestamp || b.created_at).getTime();
      return ta - tb;
    });
    return merged;
  }, [messages, queuedAsMessages]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<WhatsAppMessage | null>(null);
  const [editing, setEditing] = useState<WhatsAppMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<WhatsAppMessage | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [locationOpen, setLocationOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (conversation && conversation.unread_count > 0) markConversationRead(conversation.id);
  }, [conversation?.id, conversation?.unread_count]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    // reset local composer state when switching conversation
    setDraft("");
    setReplyTo(null);
    setEditing(null);
    setPinnedIndex(0);
  }, [conversation?.id]);

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

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/60", "rounded-lg");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/60", "rounded-lg"), 1400);
    }
  }

  const shouldQueueOffline =
    configured && connectionStatus !== "connected";

  async function handleSend() {
    if (!draft.trim() || !conversation) return;
    const text = draft.trim();

    // Edit mode: update content instead of sending new
    if (editing) {
      const res = await editMessageContent(editing.id, text);
      if (!res.ok) return toast.error("Falha ao editar");
      toast.success("Mensagem editada");
      setEditing(null);
      setDraft("");
      return;
    }

    // Offline path: queue instead of sending. Demo mode (not configured) never queues.
    if (shouldQueueOffline) {
      queueHook.enqueue({
        conversationId: conversation.id,
        phone: conversation.phone,
        text,
        replyToMessageId: replyTo?.id ?? null,
      });
      toast("Mensagem na fila", {
        description:
          "WhatsApp desconectado. A mensagem será enviada automaticamente quando a conexão voltar.",
      });
      setDraft("");
      setReplyTo(null);
      return;
    }

    setSending(true);
    const res = await sendWhatsAppText(
      conversation.phone,
      text,
      conversation.id,
      { replyToMessageId: replyTo?.id ?? null },
    );
    setSending(false);
    if (res.ok && res.simulated) {
      toast.success("Mensagem enviada", {
        description: "Modo demonstração — configure a integração em Configurações para envio real.",
      });
      setDraft("");
      setReplyTo(null);
      return;
    }
    if (!res.ok) {
      if (isNotConfigured(res)) return toast.error("Integração não configurada");
      if (isDeviceOffline(res)) return toast.error("Celular offline — verifique o WhatsApp no aparelho");
      return toast.error("Falha ao enviar");
    }
    setDraft("");
    setReplyTo(null);
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

  const bubbleActions: MessageBubbleActions = {
    onReply: (m) => { setReplyTo(m); setEditing(null); setTimeout(() => textareaRef.current?.focus(), 50); },
    onForward: (m) => setForwardMsg(m),
    onCopy: async (m) => {
      if (!m.content) return;
      try {
        await navigator.clipboard.writeText(m.content);
        toast.success("Copiado");
      } catch { toast.error("Não foi possível copiar"); }
    },
    onTogglePin: async (m) => {
      const res = await togglePinMessage(m.id, !m.pinned);
      if (!res.ok) toast.error("Falha ao fixar");
      else toast.success(m.pinned ? "Desafixada" : "Fixada");
    },
    onReact: async (m, emoji) => {
      const res = await toggleReaction(m.id, emoji);
      if (!res.ok) toast.error("Falha ao reagir");
    },
    onEdit: (m) => {
      setEditing(m);
      setReplyTo(null);
      setDraft(m.content || "");
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onRetry: async (m) => {
      // For text: delete the failed message and resend
      if (m.message_type === "text" && m.content) {
        await deleteFailedMessage(m.id);
        const res = await sendWhatsAppText(conversation.phone, m.content, conversation.id, {
          replyToMessageId: m.reply_to_message_id ?? null,
          forwardedFromMessageId: m.forwarded_from_message_id ?? null,
        });
        if (!res.ok && !res.simulated) toast.error("Falha ao reenviar");
        else toast.success("Reenviada");
      } else {
        toast.info("Reenvio disponível apenas para texto");
      }
    },
    onJumpTo: jumpToMessage,
  };

  const groups = groupByDate(visibleMessages);
  const stage = stageInfo(conversation.stage);
  const currentPinned = pinnedMessages[pinnedIndex % Math.max(pinnedMessages.length, 1)];

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

      {/* Pinned bar */}
      {pinnedMessages.length > 0 && currentPinned && (
        <button
          onClick={() => {
            jumpToMessage(currentPinned.id);
            if (pinnedMessages.length > 1) setPinnedIndex((i) => (i + 1) % pinnedMessages.length);
          }}
          className="flex items-center gap-2 px-3 py-1.5 border-b bg-primary/5 hover:bg-primary/10 transition text-left"
        >
          <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">
              {pinnedMessages.length > 1
                ? `${pinnedIndex + 1} de ${pinnedMessages.length} fixadas`
                : "Mensagem fixada"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {currentPinned.content || "[mídia]"}
            </div>
          </div>
        </button>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto wa-chat-bg py-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          <>
            {groups.map((g, gi) => (
              <div key={gi}>
                <DateSeparator label={g.label} />
                <div className="space-y-1">
                  {g.items.map((m) => (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      repliedTo={m.reply_to_message_id ? messagesById.get(m.reply_to_message_id) ?? null : null}
                      reactions={byMessage.get(m.id) || []}
                      currentUserId={currentUserId}
                      actions={bubbleActions}
                    />
                  ))}
                </div>
              </div>
            ))}
            {presenceStatus === "composing" || presenceStatus === "recording" ? (
              <div className="px-3 pt-1">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-background border border-border/60 px-3 py-2 shadow-sm">
                  <TypingDots />
                  <span className="text-[11px] text-muted-foreground">
                    {presenceStatus === "recording" ? "gravando áudio..." : "digitando..."}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Offline banner */}
      {shouldQueueOffline && (
        <div className="px-3 py-1.5 border-t bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            WhatsApp desconectado. Mensagens serão enviadas assim que a conexão voltar.
          </span>
        </div>
      )}

      {/* Reply/edit preview */}
      {(replyTo || editing) && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-start gap-2">
          <div className="w-0.5 self-stretch bg-primary rounded-full" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-primary">
              {editing ? "Editando mensagem" : `Respondendo a ${replyTo?.direction === "outbound" ? "você" : (replyTo?.sender_name || "contato")}`}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {(editing?.content || replyTo?.content || "").slice(0, 200) || "[mídia]"}
            </div>
          </div>
          <Button
            variant="ghost" size="icon" className="h-6 w-6 shrink-0"
            onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }}
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Composer */}
      <div className="px-2 py-2 border-t bg-background">
        <div className="flex items-end gap-1">
          <EmojiPickerButton onSelect={insertEmoji} />
          <StickerPicker phone={conversation.phone} conversationId={conversation.id} />
          <AttachmentButton
            phone={conversation.phone}
            conversationId={conversation.id}
            onRequestLocation={() => setLocationOpen(true)}
            onRequestContact={() => setContactOpen(true)}
          />
          <QuickReplyMenu onInsert={insertQuickReply} />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={editing ? "Editar mensagem" : "Digite uma mensagem"}
            rows={1}
            className="min-h-[40px] max-h-[140px] resize-none rounded-2xl px-4 py-2 bg-muted/40 border-transparent focus-visible:bg-background"
          />
          {draft.trim() || editing ? (
            <Button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              title={editing ? "Salvar" : "Enviar"}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          ) : (
            <AudioRecorderButton phone={conversation.phone} conversationId={conversation.id} />
          )}
        </div>
      </div>

      <ForwardDialog
        open={!!forwardMsg}
        onOpenChange={(v) => { if (!v) setForwardMsg(null); }}
        message={forwardMsg}
        conversations={conversations}
        excludeConversationId={conversation.id}
      />

      <LocationDialog
        open={locationOpen}
        onOpenChange={setLocationOpen}
        phone={conversation.phone}
        conversationId={conversation.id}
      />

      <ContactShareDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        phone={conversation.phone}
        conversationId={conversation.id}
      />
    </div>
  );
}

// ---------------- Page ----------------
export default function AdminWhatsApp() {
  const { conversations } = useWhatsAppConversations();
  const { connection } = useWhatsAppConnection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [configured, setConfigured] = useState(false);

  const queueHook = useMessageQueue();
  const { getActivePresence } = usePresenceByPhone();

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  // Detect config once (used to gate offline queue vs demo mode)
  useEffect(() => {
    (async () => {
      const res = await checkWhatsAppStatus();
      setConfigured(!isNotConfigured(res));
    })();
  }, []);

  // Drain the offline queue whenever the connection is back
  useEffect(() => {
    if (!configured) return;
    if (connection?.status !== "connected") return;
    if (queueHook.getPendingCount() === 0) return;
    queueHook.processQueue(async (item) => {
      const res = await sendWhatsAppText(item.phone, item.text, item.conversationId, {
        replyToMessageId: item.replyToMessageId ?? null,
      });
      if (res.ok) return { ok: true };
      if (isDeviceOffline(res)) return { ok: false, error: "Celular offline" };
      if (isNotConfigured(res)) return { ok: false, error: "Não configurado" };
      return { ok: false, error: "Falha ao enviar" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.status, configured]);

  const selectedPresence: PresenceStatus = selected
    ? getActivePresence(selected.phone)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="admin-h1 text-2xl md:text-3xl">WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central de conversas conectada via WhatsApp, com CRM, funil de vendas e respostas rápidas.
          </p>
        </div>
        <HeaderStatusBadge />
      </div>

      <Card className="bg-card/80 border-border/30 overflow-hidden h-[calc(100vh-220px)] min-h-[560px]">
        <div className="flex h-full min-h-0">
          <div className={`w-full lg:w-[340px] xl:w-[380px] border-r border-border shrink-0 ${selected ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setContextOpen(false); }}
              search={search}
              onSearchChange={setSearch}
              getPresence={getActivePresence}
            />
          </div>

          <div className={`flex-1 min-w-0 ${!selected ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
            <MessageThread
              conversation={selected}
              conversations={conversations}
              onBack={() => setSelectedId(null)}
              onToggleContext={() => setContextOpen((v) => !v)}
              contextOpen={contextOpen}
              connectionStatus={connection?.status}
              configured={configured}
              queueHook={queueHook}
              presenceStatus={selectedPresence}
            />
          </div>

          {selected && contextOpen && (
            <div className="hidden lg:flex w-[340px] xl:w-[380px] border-l border-border/40 shrink-0 flex-col min-h-0">
              <ContextPanel conversation={selected} onClose={() => setContextOpen(false)} />
            </div>
          )}
        </div>
      </Card>

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
