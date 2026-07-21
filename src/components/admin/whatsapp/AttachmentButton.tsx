import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Paperclip, Image as ImageIcon, FileText, Loader2,
  Video as VideoIcon, MapPin, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { uploadWhatsAppMedia } from "@/lib/whatsappMedia";
import {
  sendWhatsAppImage,
  sendWhatsAppVideo,
  sendWhatsAppDocument,
  isNotConfigured,
  isDeviceOffline,
} from "@/lib/zapi";

interface Props {
  phone: string;
  conversationId: string;
  disabled?: boolean;
  onRequestLocation?: () => void;
  onRequestContact?: () => void;
}

const MAX_MB = 20;

export function AttachmentButton({
  phone, conversationId, disabled, onRequestLocation, onRequestContact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${MAX_MB} MB`);
      return;
    }
    const isVideo = (f.type || "").startsWith("video/");
    const isImage = (f.type || "").startsWith("image/");
    const isDoc = !isVideo && !isImage;

    setBusy(true);
    try {
      const uploaded = await uploadWhatsAppMedia(f);
      const res = isVideo
        ? await sendWhatsAppVideo(phone, uploaded.signedUrl, "", conversationId)
        : isImage
        ? await sendWhatsAppImage(phone, uploaded.signedUrl, "", conversationId)
        : await sendWhatsAppDocument(
            phone, uploaded.signedUrl, uploaded.extension, uploaded.fileName, conversationId,
          );

      const label = isVideo ? "Vídeo" : isImage ? "Imagem" : "Documento";

      if (res.ok && res.simulated) {
        toast.success(`${label} enviado`, {
          description: "Modo demonstração — configure a integração em Configurações para envio real.",
        });
      } else if (res.ok) {
        toast.success(`${label} enviado`);
      } else if (isNotConfigured(res)) {
        toast.error("Integração não configurada");
      } else if (isDeviceOffline(res)) {
        toast.error("Celular offline — verifique o WhatsApp no aparelho");
      } else {
        toast.error(`Falha ao enviar ${label.toLowerCase()}`);
      }
      // Suppress noisy fallthrough for doc when caller didn't pick a doc
      if (isDoc && !res.ok && !res.reason) {
        // no-op, already handled
      }
    } catch (err) {
      console.error("[wa] upload failed", err);
      toast.error("Falha no upload do arquivo");
    } finally {
      setBusy(false);
      setOpen(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  const Item = ({
    icon, label, onClick, colorClass,
  }: { icon: React.ReactNode; label: string; onClick: () => void; colorClass: string }) => (
    <button
      type="button"
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted text-left"
      onClick={onClick}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            title="Anexar"
            disabled={disabled || busy}
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-60 p-1.5" sideOffset={8}>
          <Item
            icon={<ImageIcon className="w-4 h-4" />}
            label="Foto"
            colorClass="bg-primary/15 text-primary"
            onClick={() => {
              if (mediaInputRef.current) mediaInputRef.current.accept = "image/*";
              mediaInputRef.current?.click();
            }}
          />
          <Item
            icon={<VideoIcon className="w-4 h-4" />}
            label="Vídeo"
            colorClass="bg-primary/15 text-primary"
            onClick={() => {
              if (mediaInputRef.current) mediaInputRef.current.accept = "video/*";
              mediaInputRef.current?.click();
            }}
          />
          <Item
            icon={<FileText className="w-4 h-4" />}
            label="Documento"
            colorClass="bg-primary/15 text-primary"
            onClick={() => docInputRef.current?.click()}
          />
          {onRequestLocation && (
            <Item
              icon={<MapPin className="w-4 h-4" />}
              label="Localização"
              colorClass="bg-primary/15 text-primary"
              onClick={() => { setOpen(false); onRequestLocation(); }}
            />
          )}
          {onRequestContact && (
            <Item
              icon={<UserPlus className="w-4 h-4" />}
              label="Contato"
              colorClass="bg-primary/15 text-primary"
              onClick={() => { setOpen(false); onRequestContact(); }}
            />
          )}
        </PopoverContent>
      </Popover>

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  );
}
