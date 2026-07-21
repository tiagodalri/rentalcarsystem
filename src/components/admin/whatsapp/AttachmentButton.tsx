import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Paperclip, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadWhatsAppMedia } from "@/lib/whatsappMedia";
import {
  sendWhatsAppImage,
  sendWhatsAppDocument,
  isNotConfigured,
  isDeviceOffline,
} from "@/lib/zapi";

interface Props {
  phone: string;
  conversationId: string;
  disabled?: boolean;
}

const MAX_MB = 20;

export function AttachmentButton({ phone, conversationId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null, kind: "image" | "document") {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${MAX_MB} MB`);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadWhatsAppMedia(f);
      const res =
        kind === "image"
          ? await sendWhatsAppImage(phone, uploaded.signedUrl, "", conversationId)
          : await sendWhatsAppDocument(
              phone,
              uploaded.signedUrl,
              uploaded.extension,
              uploaded.fileName,
              conversationId,
            );

      if (res.ok && res.simulated) {
        toast.success(kind === "image" ? "Imagem enviada" : "Documento enviado", {
          description: "Modo demonstração — configure a Z-API em Configurações para envio real.",
        });
      } else if (res.ok) {
        toast.success(kind === "image" ? "Imagem enviada" : "Documento enviado");
      } else if (isNotConfigured(res)) {
        toast.error("Integração não configurada");
      } else if (isDeviceOffline(res)) {
        toast.error("Celular offline — verifique o WhatsApp no aparelho");
      } else {
        toast.error("Falha ao enviar arquivo");
      }
    } catch (err) {
      console.error("[wa] upload failed", err);
      toast.error("Falha no upload do arquivo");
    } finally {
      setBusy(false);
      setOpen(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

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
        <PopoverContent side="top" align="start" className="w-56 p-1.5" sideOffset={8}>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted text-left"
            onClick={() => imgInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span>Foto ou vídeo</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-muted text-left"
            onClick={() => docInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span>Documento</span>
          </button>
        </PopoverContent>
      </Popover>

      <input
        ref={imgInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files, "image")}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files, "document")}
      />
    </>
  );
}
