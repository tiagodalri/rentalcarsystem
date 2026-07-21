import { Check, CheckCheck, FileText, Mic, Video } from "lucide-react";
import type { WhatsAppMessage } from "@/hooks/useWhatsAppMessages";

function StatusTicks({ status }: { status: WhatsAppMessage["status"] }) {
  if (status === "pending") return <Check className="w-3.5 h-3.5 opacity-50" />;
  if (status === "sent") return <Check className="w-3.5 h-3.5 opacity-70" />;
  if (status === "delivered") return <CheckCheck className="w-3.5 h-3.5 opacity-70" />;
  if (status === "read") return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (status === "failed") return <span className="text-[10px] text-destructive">falhou</span>;
  return null;
}

/** WhatsApp-style tail SVG (curved). Mirrored via CSS for outbound. */
function BubbleTail({ isOut }: { isOut: boolean }) {
  // Two fill colors: incoming = card white/neutral, outgoing = green.
  const fillClass = isOut
    ? "fill-[#d9fdd3] dark:fill-emerald-900/40"
    : "fill-white dark:fill-neutral-800";
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 13"
      width="8"
      height="13"
      className={`absolute top-0 ${isOut ? "-right-[7px]" : "-left-[7px] -scale-x-100"} ${fillClass}`}
      style={{ filter: "drop-shadow(0 1px 0.5px rgba(0,0,0,0.08))" }}
    >
      <path d="M8 0L0 0C0 0 4 0 4 4C4 8 0 13 0 13C0 13 8 8 8 4L8 0Z" />
    </svg>
  );
}

export function MessageBubble({ m }: { m: WhatsAppMessage }) {
  const isOut = m.direction === "outbound";
  const time = m.timestamp
    ? new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"} px-2`}>
      <div
        className={`
          relative max-w-[75%] min-w-[64px] px-2.5 py-1.5 text-[14px] leading-[1.35]
          shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]
          ${isOut
            ? "bg-[#d9fdd3] dark:bg-emerald-900/40 rounded-lg rounded-tr-[2px]"
            : "bg-white dark:bg-neutral-800 rounded-lg rounded-tl-[2px]"}
        `}
      >
        <BubbleTail isOut={isOut} />

        {m.media_url && m.message_type === "image" && (
          <img
            src={m.media_url}
            alt=""
            className="rounded-md mb-1 max-w-full max-h-[300px] object-cover"
            loading="lazy"
          />
        )}
        {m.message_type === "document" && (
          <a
            href={m.media_url ?? undefined}
            target="_blank"
            rel="noreferrer"
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
          <div className="whitespace-pre-wrap break-words text-neutral-900 dark:text-neutral-100">
            {m.content}
          </div>
        )}

        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span>{time}</span>
          {isOut && <StatusTicks status={m.status} />}
        </div>
      </div>
    </div>
  );
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="text-[11px] px-2.5 py-1 rounded-md bg-white/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 shadow-sm">
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
