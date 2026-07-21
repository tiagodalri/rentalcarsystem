import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sticker, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  sendWhatsAppSticker,
  isNotConfigured,
  isDeviceOffline,
} from "@/lib/zapi";

/**
 * Lightweight sticker set. Uses public emoji-image CDN (Twemoji) so we get real
 * PNG URLs that WhatsApp will render as stickers when the endpoint is available.
 * Falls back to send-image on the proxy side.
 */
const STICKERS: { label: string; url: string }[] = [
  { label: "👍", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png" },
  { label: "❤️", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png" },
  { label: "😂", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f602.png" },
  { label: "🎉", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png" },
  { label: "🙏", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f64f.png" },
  { label: "🔥", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png" },
  { label: "✅", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2705.png" },
  { label: "🚗", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f697.png" },
  { label: "🔑", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f511.png" },
  { label: "🗓️", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f5d3.png" },
  { label: "💰", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4b0.png" },
  { label: "👋", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44b.png" },
];

interface Props {
  phone: string;
  conversationId: string;
  disabled?: boolean;
}

export function StickerPicker({ phone, conversationId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(url: string) {
    setBusy(true);
    try {
      const res = await sendWhatsAppSticker(phone, url, conversationId);
      if (res.ok && res.simulated) toast.success("Figurinha enviada", { description: "Modo demonstração." });
      else if (res.ok) toast.success("Figurinha enviada");
      else if (isNotConfigured(res)) toast.error("Integração não configurada");
      else if (isDeviceOffline(res)) toast.error("Celular offline");
      else toast.error("Falha ao enviar figurinha");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="ghost" size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          title="Figurinha"
          disabled={disabled || busy}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sticker className="w-5 h-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="p-2 w-[260px]" sideOffset={8}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pb-1.5">
          Figurinhas
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STICKERS.map((s) => (
            <button
              key={s.url}
              onClick={() => send(s.url)}
              className="aspect-square rounded-md hover:bg-muted flex items-center justify-center transition"
              title={s.label}
            >
              <img src={s.url} alt={s.label} className="w-10 h-10" loading="lazy" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
