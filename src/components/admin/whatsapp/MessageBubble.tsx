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

export function MessageBubble({ m }: { m: WhatsAppMessage }) {
  const isOut = m.direction === "outbound";
  const time = m.timestamp
    ? new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"} px-1`}>
      <div
        className={`
          relative max-w-[75%] px-2.5 pt-1.5 pb-1 text-[14px] leading-snug
          shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]
          ${isOut
            ? "bg-[#d9fdd3] dark:bg-emerald-900/40 rounded-lg rounded-tr-[2px]"
            : "bg-white dark:bg-neutral-800 rounded-lg rounded-tl-[2px]"}
        `}
      >
        {/* Tail */}
        <span
          aria-hidden
          className={`absolute top-0 w-2 h-3 overflow-hidden ${isOut ? "-right-2" : "-left-2"}`}
        >
          <span
            className={`
              block w-3 h-3 -mt-[1px] rotate-45
              ${isOut ? "bg-[#d9fdd3] dark:bg-emerald-900/40 -ml-1" : "bg-white dark:bg-neutral-800 ml-1"}
            `}
          />
        </span>

        {m.media_url && m.message_type === "image" && (
          <img src={m.media_url} alt="" className="rounded-md mb-1 max-w-full max-h-[300px] object-cover" />
        )}
        {m.message_type === "document" && (
          <div className="flex items-center gap-2 mb-1 text-xs bg-black/5 dark:bg-white/5 rounded px-2 py-1.5">
            <FileText className="w-4 h-4 opacity-70" />
            <span className="truncate">{m.content || "Documento"}</span>
          </div>
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
          <div className="whitespace-pre-wrap break-words pr-14 text-neutral-900 dark:text-neutral-100">
            {m.content}
          </div>
        )}

        <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
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
