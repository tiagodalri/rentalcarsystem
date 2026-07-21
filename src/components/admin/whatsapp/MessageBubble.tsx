import { useState, forwardRef } from "react";
import {
  Check, CheckCheck, FileText, MoreVertical,
  Reply, Forward, Copy, Pin, PinOff, Pencil, Smile, RotateCw, CornerUpLeft,
  MapPin, User as UserIcon, ExternalLink,
} from "lucide-react";
import type { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";
import type { WhatsAppReaction } from "@/hooks/useMessageReactions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmojiPickerButton } from "./EmojiPickerButton";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function StatusTicks({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "pending") return <Check className="w-3.5 h-3.5 opacity-50" />;
  if (status === "sent") return <Check className="w-3.5 h-3.5 opacity-70" />;
  if (status === "delivered") return <CheckCheck className="w-3.5 h-3.5 opacity-70" />;
  if (status === "read") return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (status === "failed") return <span className="text-[10px] text-destructive font-medium uppercase tracking-wider">falhou</span>;
  return null;
}

function BubbleTail({ isOut }: { isOut: boolean }) {
  const fillClass = isOut
    ? "fill-primary/15 dark:fill-primary/25"
    : "fill-card dark:fill-card";
  return (
    <svg
      aria-hidden viewBox="0 0 8 13" width="8" height="13"
      className={`absolute top-0 ${isOut ? "-right-[7px]" : "-left-[7px] -scale-x-100"} ${fillClass}`}
    >
      <path d="M8 0L0 0C0 0 4 0 4 4C4 8 0 13 0 13C0 13 8 8 8 4L8 0Z" />
    </svg>
  );
}

function messageShortPreview(m?: WhatsAppMessage | null): string {
  if (!m) return "…";
  if (m.message_type === "image") return "[imagem] " + (m.content || "");
  if (m.message_type === "document") return "[documento] " + (m.content || "");
  if (m.message_type === "audio") return "[áudio]";
  if (m.message_type === "video") return "[vídeo]";
  return m.content || "";
}

export interface MessageBubbleActions {
  onReply: (m: WhatsAppMessage) => void;
  onForward: (m: WhatsAppMessage) => void;
  onCopy: (m: WhatsAppMessage) => void;
  onTogglePin: (m: WhatsAppMessage) => void;
  onReact: (m: WhatsAppMessage, emoji: string) => void;
  onEdit: (m: WhatsAppMessage) => void;
  onRetry: (m: WhatsAppMessage) => void;
  onJumpTo: (messageId: string) => void;
}

interface Props {
  m: WhatsAppMessage;
  repliedTo?: WhatsAppMessage | null;
  reactions?: WhatsAppReaction[];
  currentUserId?: string | null;
  actions: MessageBubbleActions;
}

export const MessageBubble = forwardRef<HTMLDivElement, Props>(function MessageBubble(
  { m, repliedTo, reactions, currentUserId, actions }, ref,
) {
  const isOut = m.direction === "outbound";
  const time = m.timestamp
    ? new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const editable =
    isOut &&
    m.message_type === "text" &&
    !!m.timestamp &&
    Date.now() - new Date(m.timestamp).getTime() < 15 * 60 * 1000;
  const isFailed = m.status === "failed";

  // group reactions by emoji
  const grouped = (reactions || []).reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      const cur = acc[r.emoji] || { count: 0, mine: false };
      cur.count += 1;
      if (currentUserId && r.user_id === currentUserId) cur.mine = true;
      acc[r.emoji] = cur;
      return acc;
    }, {},
  );

  const [reactOpen, setReactOpen] = useState(false);

  const actionRail = (
    <div
      className={`
        absolute top-1 ${isOut ? "-left-24" : "-right-24"}
        opacity-0 group-hover:opacity-100 transition-opacity
        flex items-center gap-0.5 bg-card border border-border/40 rounded-full shadow-sm px-1 py-0.5
      `}
    >
      <Popover open={reactOpen} onOpenChange={setReactOpen}>
        <PopoverTrigger asChild>
          <button className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" title="Reagir">
            <Smile className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="p-1 w-auto">
          <div className="flex items-center gap-0.5">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { actions.onReact(m, e); setReactOpen(false); }}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-base transition"
              >
                {e}
              </button>
            ))}
            <div className="ml-0.5">
              <EmojiPickerButton onSelect={(e) => { actions.onReact(m, e); setReactOpen(false); }} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <button
        onClick={() => actions.onReply(m)}
        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" title="Responder"
      >
        <Reply className="w-3.5 h-3.5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" title="Mais">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOut ? "start" : "end"} className="w-48">
          <DropdownMenuItem onClick={() => actions.onReply(m)}>
            <Reply className="w-4 h-4 mr-2" /> Responder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onForward(m)}>
            <Forward className="w-4 h-4 mr-2" /> Encaminhar
          </DropdownMenuItem>
          {m.content && (
            <DropdownMenuItem onClick={() => actions.onCopy(m)}>
              <Copy className="w-4 h-4 mr-2" /> Copiar texto
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => actions.onTogglePin(m)}>
            {m.pinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
            {m.pinned ? "Desafixar" : "Fixar"}
          </DropdownMenuItem>
          {editable && (
            <DropdownMenuItem onClick={() => actions.onEdit(m)}>
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </DropdownMenuItem>
          )}
          {isFailed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onRetry(m)}>
                <RotateCw className="w-4 h-4 mr-2" /> Reenviar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div
      ref={ref}
      id={`msg-${m.id}`}
      className={`group flex ${isOut ? "justify-end" : "justify-start"} px-2 scroll-mt-24`}
    >
      <div className="relative">
        {actionRail}
        <div
          className={`
            relative max-w-[75%] min-w-[64px] px-2.5 py-1.5 text-[14px] leading-[1.35]
            shadow-sm border border-border/30
            ${isOut
              ? "bg-primary/15 dark:bg-primary/25 rounded-lg rounded-tr-[2px]"
              : "bg-card rounded-lg rounded-tl-[2px]"}
            ${m.pinned ? "ring-1 ring-primary/40" : ""}
          `}
        >
          <BubbleTail isOut={isOut} />

          {(m.pinned || m.forwarded_from_message_id) && (
            <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.forwarded_from_message_id && (
                <span className="inline-flex items-center gap-1">
                  <CornerUpLeft className="w-3 h-3" /> Encaminhada
                </span>
              )}
              {m.pinned && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Pin className="w-3 h-3" /> Fixada
                </span>
              )}
            </div>
          )}

          {repliedTo && (
            <button
              onClick={() => actions.onJumpTo(repliedTo.id)}
              className="w-full mb-1.5 pl-2 pr-2 py-1 text-left rounded border-l-2 border-primary bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                {repliedTo.direction === "outbound" ? "Você" : (repliedTo.sender_name || "Contato")}
              </div>
              <div className="text-[11px] text-muted-foreground line-clamp-2">
                {messageShortPreview(repliedTo)}
              </div>
            </button>
          )}

          {m.media_url && m.message_type === "image" && (
            <img
              src={m.media_url} alt="" loading="lazy"
              className="rounded-md mb-1 max-w-full max-h-[300px] object-cover"
            />
          )}
          {m.message_type === "document" && (
            <a
              href={m.media_url ?? undefined} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 mb-1 text-xs bg-black/5 dark:bg-white/5 rounded px-2 py-1.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <FileText className="w-4 h-4 opacity-70 shrink-0" />
              <span className="truncate">{m.content || "Documento"}</span>
            </a>
          )}
          {m.message_type === "audio" && (
            <div className="flex items-center gap-2 mb-1 text-xs">
              <Mic className="w-4 h-4 opacity-70" /> Áudio
            </div>
          )}
          {m.message_type === "video" && (
            <div className="flex items-center gap-2 mb-1 text-xs">
              <Video className="w-4 h-4 opacity-70" /> Vídeo
            </div>
          )}

          {m.content && m.message_type !== "document" && (
            <div className="whitespace-pre-wrap break-words text-foreground">
              {m.content}
            </div>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            {m.edited_at && <span className="italic">editada</span>}
            <span>{time}</span>
            {isOut && <StatusTicks status={m.status} />}
          </div>

          {Object.keys(grouped).length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
              {Object.entries(grouped).map(([emoji, info]) => (
                <button
                  key={emoji}
                  onClick={() => actions.onReact(m, emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition ${
                    info.mine
                      ? "bg-primary/20 border-primary/40 text-foreground"
                      : "bg-card border-border/40 hover:bg-muted"
                  }`}
                  title={info.mine ? "Remover reação" : "Reagir"}
                >
                  <span>{emoji}</span>
                  <span className="tabular-nums text-muted-foreground">{info.count}</span>
                </button>
              ))}
            </div>
          )}

          {isFailed && (
            <div className="mt-1 flex justify-end">
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                onClick={() => actions.onRetry(m)}
              >
                <RotateCw className="w-3 h-3 mr-1" /> Reenviar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="text-[11px] px-2.5 py-1 rounded-md bg-card border border-border/40 text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}

export function dateLabel(d: Date): string {
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Hoje";
  if (same(d, y)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}
