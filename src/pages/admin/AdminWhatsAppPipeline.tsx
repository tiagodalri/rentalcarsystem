import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import {
  useWhatsAppConversations,
  updateConversationStage,
  type WhatsAppConversation,
  type FunnelStage,
} from "@/hooks/useWhatsAppConversations";
import { STAGES, STAGE_BADGE_BASE, tagClass, stageInfo } from "@/components/admin/whatsapp/stage";
import { formatPersonName } from "@/lib/formatName";

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

interface CardProps {
  conversation: WhatsAppConversation;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  dragging: boolean;
}

function PipelineCard({ conversation, onOpen, onDragStart, onDragEnd, dragging }: CardProps) {
  const displayName = conversation.contact_name
    ? formatPersonName(conversation.contact_name)
    : formatPhone(conversation.phone);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", conversation.id);
        onDragStart(conversation.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(conversation.id)}
      className={`group rounded-lg border border-border/50 bg-card p-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <PersonAvatar name={displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate">{displayName}</div>
            {conversation.unread_count > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary text-primary-foreground shrink-0">
                {conversation.unread_count}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {formatPhone(conversation.phone)}
          </div>
          {conversation.last_message_preview && (
            <div className="text-xs text-muted-foreground/90 mt-1.5 line-clamp-2">
              {conversation.last_message_preview}
            </div>
          )}
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conversation.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${tagClass(t)}`}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminWhatsAppPipeline() {
  const { conversations, loading } = useWhatsAppConversations();
  const navigate = useNavigate();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<FunnelStage, WhatsAppConversation[]>();
    STAGES.forEach((s) => map.set(s.value, []));
    for (const c of conversations) {
      const stage = (c.stage as FunnelStage) || "novo_lead";
      if (!map.has(stage)) map.set(stage, []);
      map.get(stage)!.push(c);
    }
    return map;
  }, [conversations]);

  function handleOpen(id: string) {
    navigate(`/admin/whatsapp?conversation=${id}`);
  }

  async function handleDrop(stage: FunnelStage) {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (!id) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv || conv.stage === stage) return;
    try {
      await updateConversationStage(id, stage);
      toast.success(`Movido para ${stageInfo(stage).label}`);
    } catch (err) {
      console.error("[pipeline] update failed", err);
      toast.error("Falha ao mover conversa");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/whatsapp">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                WhatsApp
              </Button>
            </Link>
          </div>
          <h1 className="admin-h1 text-2xl md:text-3xl mt-1">Funil de vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste as conversas entre as colunas para atualizar o estágio. Clique num card para abrir a conversa.
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {STAGES.map((stage) => {
          const items = grouped.get(stage.value) ?? [];
          const isOver = dragOverStage === stage.value;
          return (
            <div
              key={stage.value}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverStage !== stage.value) setDragOverStage(stage.value);
              }}
              onDragLeave={(e) => {
                // only clear if leaving the column entirely
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverStage((s) => (s === stage.value ? null : s));
              }}
              onDrop={() => handleDrop(stage.value)}
              className={`w-[280px] shrink-0 flex flex-col rounded-xl border transition-colors ${
                isOver ? "ring-2 ring-primary/50 border-primary/40 bg-primary/5" : "border-border/40 bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                  <span className={`${STAGE_BADGE_BASE} ${stage.cls}`}>{stage.label}</span>
                </div>
                <Badge variant="secondary" className="h-5 text-[10px] shrink-0">
                  {items.length}
                </Badge>
              </div>
              <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto">
                {items.length === 0 && !loading && (
                  <div className="text-center py-8 px-2 text-[11px] text-muted-foreground">
                    <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-40" />
                    Nenhuma conversa neste estágio
                  </div>
                )}
                {items.map((c) => (
                  <PipelineCard
                    key={c.id}
                    conversation={c}
                    onOpen={handleOpen}
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStage(null);
                    }}
                    dragging={draggingId === c.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
