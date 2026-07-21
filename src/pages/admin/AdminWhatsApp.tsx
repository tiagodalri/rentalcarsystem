import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Phone,
  RefreshCw,
  Power,
  RotateCcw,
  Send,
  QrCode,
  Loader2,
  AlertCircle,
  Search,
  Image as ImageIcon,
  FileText,
  Mic,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useWhatsAppConversations, markConversationRead, type WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, type WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import {
  checkWhatsAppStatus,
  disconnectWhatsApp,
  getWhatsAppQrCode,
  isDeviceOffline,
  isNotConfigured,
  restartWhatsAppInstance,
  runWhatsAppHeartbeat,
  sendWhatsAppText,
} from "@/lib/zapi";
import { formatPersonName } from "@/lib/formatName";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}

function MessageTypeIcon({ type }: { type: WhatsAppMessage["message_type"] }) {
  const cls = "w-3.5 h-3.5 inline-block mr-1 opacity-70";
  switch (type) {
    case "image":
      return <ImageIcon className={cls} />;
    case "video":
      return <Video className={cls} />;
    case "audio":
      return <Mic className={cls} />;
    case "document":
      return <FileText className={cls} />;
    default:
      return null;
  }
}

function StatusPill({
  status,
  configured,
}: {
  status: string | undefined;
  configured: boolean;
}) {
  if (!configured) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Não configurado
      </Badge>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: "Conectado", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    connecting: { label: "Conectando", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    disconnected: { label: "Desconectado", cls: "bg-muted text-muted-foreground border-border" },
  };
  const info = map[status || "disconnected"];
  return <Badge variant="outline" className={info.cls}>{info.label}</Badge>;
}

// ---------------- Connection Card ----------------
function ConnectionCard() {
  const { connection, loading } = useWhatsAppConnection();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrExpiresIn, setQrExpiresIn] = useState<number>(20);
  const pollingRef = useRef<number | null>(null);
  const pollingStartedAt = useRef<number>(0);
  const qrTimerRef = useRef<number | null>(null);

  const isConnected = connection?.status === "connected";

  // Initial probe — detect configuration
  useEffect(() => {
    (async () => {
      const res = await checkWhatsAppStatus();
      if (isNotConfigured(res)) {
        setConfigured(false);
      } else {
        setConfigured(true);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      if (qrTimerRef.current) window.clearInterval(qrTimerRef.current);
    };
  }, []);

  async function loadQrCode() {
    setBusy("qr");
    const res = await getWhatsAppQrCode();
    setBusy(null);
    if (isNotConfigured(res)) {
      setConfigured(false);
      return;
    }
    // Z-API returns the QR as base64 in .value or a string. Handle both.
    const raw = res.data as { value?: string; qrcode?: string } | string | undefined;
    let img: string | null = null;
    if (typeof raw === "string") {
      img = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    } else if (raw?.value) {
      img = raw.value.startsWith("data:") ? raw.value : `data:image/png;base64,${raw.value}`;
    } else if (raw?.qrcode) {
      img = raw.qrcode.startsWith("data:") ? raw.qrcode : `data:image/png;base64,${raw.qrcode}`;
    }
    if (!img) {
      toast.error("Não foi possível gerar QR Code");
      return;
    }
    setQrCode(img);
    setQrExpiresIn(20);

    // Auto-refresh QR every 20s
    if (qrTimerRef.current) window.clearInterval(qrTimerRef.current);
    qrTimerRef.current = window.setInterval(() => {
      setQrExpiresIn((v) => {
        if (v <= 1) {
          loadQrCode();
          return 20;
        }
        return v - 1;
      });
    }, 1000);

    // Poll status every 3s for up to 3 min
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingStartedAt.current = Date.now();
    pollingRef.current = window.setInterval(async () => {
      if (Date.now() - pollingStartedAt.current > 3 * 60 * 1000) {
        window.clearInterval(pollingRef.current!);
        return;
      }
      const s = await runWhatsAppHeartbeat();
      if (s.data && (s.data as { connected?: boolean }).connected) {
        window.clearInterval(pollingRef.current!);
        if (qrTimerRef.current) window.clearInterval(qrTimerRef.current);
        setQrCode(null);
        toast.success("WhatsApp conectado");
      }
    }, 3000);
  }

  async function handleHeartbeat() {
    setBusy("heartbeat");
    const res = await runWhatsAppHeartbeat();
    setBusy(null);
    if (isNotConfigured(res)) {
      setConfigured(false);
      toast.error("Integração não configurada");
      return;
    }
    if (isDeviceOffline(res)) {
      toast.warning("Celular sem resposta (offline)");
      return;
    }
    toast.success(res.data?.connected ? "Conectado" : "Desconectado");
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o WhatsApp?")) return;
    setBusy("disconnect");
    const res = await disconnectWhatsApp();
    setBusy(null);
    if (res.ok) toast.success("Desconectado");
    else toast.error("Falha ao desconectar");
  }

  async function handleRestart() {
    setBusy("restart");
    const res = await restartWhatsAppInstance();
    setBusy(null);
    if (res.ok) toast.success("Instância reiniciada");
    else toast.error("Falha ao reiniciar");
  }

  if (configured === false) {
    return (
      <Card className="p-6 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold mb-1">Integração WhatsApp não configurada</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Adicione os seguintes segredos em <strong>Configurações do Projeto → Secrets</strong> para ativar a
              integração com a Z-API:
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 font-mono">
              <li>• ZAPI_INSTANCE_ID</li>
              <li>• ZAPI_TOKEN</li>
              <li>• ZAPI_CLIENT_TOKEN</li>
              <li>• ZAPI_WEBHOOK_SECRET</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Depois de configurar, retorne a esta página para conectar seu número via QR Code.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Conexão WhatsApp</h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill status={connection?.status} configured={configured !== false} />
              {connection?.connected_phone && (
                <span className="text-xs text-muted-foreground">{formatPhone(connection.connected_phone)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleHeartbeat} disabled={!!busy}>
            {busy === "heartbeat" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2 hidden sm:inline">Testar</span>
          </Button>
          {isConnected && (
            <>
              <Button size="sm" variant="outline" onClick={handleRestart} disabled={!!busy}>
                <RotateCcw className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Reiniciar</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={!!busy}>
                <Power className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Desconectar</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {!isConnected && !loading && (
        <div className="border-t pt-4 mt-2">
          {qrCode ? (
            <div className="flex flex-col items-center gap-3">
              <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56 rounded-lg border" />
              <p className="text-xs text-muted-foreground">
                Abra WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
              </p>
              <p className="text-[11px] text-muted-foreground">Atualiza em {qrExpiresIn}s</p>
            </div>
          ) : (
            <Button onClick={loadQrCode} disabled={busy === "qr"} className="w-full sm:w-auto">
              {busy === "qr" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
              Conectar via QR Code
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------- Conversation List ----------------
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
        c.phone.includes(q.replace(/\D/g, "")),
    );
  }, [conversations, search]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma conversa ainda.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((c) => {
              const isActive = c.id === selectedId;
              const displayName = c.contact_name
                ? formatPersonName(c.contact_name)
                : formatPhone(c.phone);
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {c.last_message_preview || "—"}
                    </p>
                    {c.unread_count > 0 && (
                      <Badge className="h-4 min-w-[16px] px-1 text-[10px] bg-emerald-600 hover:bg-emerald-600">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------------- Message Thread ----------------
function MessageThread({ conversation }: { conversation: WhatsAppConversation | null }) {
  const { messages, loading } = useWhatsAppMessages(conversation?.id ?? null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markConversationRead(conversation.id);
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Selecione uma conversa
      </div>
    );
  }

  const displayName = conversation.contact_name
    ? formatPersonName(conversation.contact_name)
    : formatPhone(conversation.phone);

  async function handleSend() {
    if (!draft.trim() || !conversation) return;
    setSending(true);
    const res = await sendWhatsAppText(conversation.phone, draft.trim());
    setSending(false);
    if (isNotConfigured(res)) {
      toast.error("Integração não configurada");
      return;
    }
    if (isDeviceOffline(res)) {
      toast.error("Celular offline — verifique o WhatsApp no aparelho");
      return;
    }
    if (!res.ok) {
      toast.error("Falha ao enviar");
      return;
    }
    setDraft("");
    toast.success("Mensagem enviada");
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{displayName}</div>
          <div className="text-[11px] text-muted-foreground">{formatPhone(conversation.phone)}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            Nenhuma mensagem ainda
          </div>
        ) : (
          messages.map((m) => {
            const isOut = m.direction === "outbound";
            return (
              <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isOut
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border rounded-bl-sm"
                  }`}
                >
                  {m.message_type !== "text" && (
                    <div className="text-xs opacity-70 mb-1">
                      <MessageTypeIcon type={m.message_type} />
                      <span className="capitalize">{m.message_type}</span>
                    </div>
                  )}
                  {m.media_url && m.message_type === "image" && (
                    <img src={m.media_url} alt="" className="rounded-lg mb-1 max-w-full" />
                  )}
                  {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                  <div className={`text-[10px] mt-1 ${isOut ? "opacity-70" : "text-muted-foreground"}`}>
                    {m.timestamp
                      ? new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                      : ""}
                    {isOut && <> · {m.status}</>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escreva uma mensagem…"
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none"
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()} size="icon">
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

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="admin-h1 text-2xl md:text-3xl">WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Central de conversas conectada via Z-API. Envie e receba mensagens do número comercial.
        </p>
      </div>

      <ConnectionCard />

      <Card className="overflow-hidden h-[calc(100vh-320px)] min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] h-full min-h-0">
          <div className="border-r hidden md:flex md:flex-col min-h-0">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search={search}
              onSearchChange={setSearch}
            />
          </div>

          {/* Mobile: show list OR thread */}
          {selected ? (
            <div className="flex flex-col min-h-0 md:hidden">
              <button
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 text-xs text-primary border-b text-left"
              >
                ← Voltar
              </button>
              <div className="flex-1 min-h-0">
                <MessageThread conversation={selected} />
              </div>
            </div>
          ) : (
            <div className="md:hidden min-h-0 flex flex-col">
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                search={search}
                onSearchChange={setSearch}
              />
            </div>
          )}

          <div className="hidden md:flex md:flex-col min-h-0">
            <MessageThread conversation={selected} />
          </div>
        </div>
      </Card>
    </div>
  );
}
