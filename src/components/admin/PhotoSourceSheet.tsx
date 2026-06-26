import { Camera, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PhotoSourceSheetProps {
  open: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  title?: string;
  description?: string;
  /** Show a "Galeria (várias)" hint */
  allowMultiple?: boolean;
}

/**
 * Bottom-sheet-style picker that lets the user choose between opening the
 * device camera or selecting a photo already saved on their device.
 * Works in PWA, mobile browser and desktop.
 */
export function PhotoSourceSheet({
  open,
  onClose,
  onPickCamera,
  onPickGallery,
  title = "Adicionar foto",
  description = "Tire uma foto agora ou anexe uma já salva no aparelho.",
  allowMultiple = false,
}: PhotoSourceSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 pt-4">
          <button
            type="button"
            onClick={() => {
              onPickCamera();
              onClose();
            }}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted/60 active:bg-muted transition-colors p-5 min-h-[112px]"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-foreground/5 group-hover:bg-foreground/10 transition-colors">
              <Camera size={20} />
            </span>
            <span className="text-sm font-medium">Câmera</span>
            <span className="text-[11px] text-muted-foreground">Tirar foto agora</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onPickGallery();
              onClose();
            }}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted/60 active:bg-muted transition-colors p-5 min-h-[112px]"
          >
            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-foreground/5 group-hover:bg-foreground/10 transition-colors">
              <ImageIcon size={20} />
            </span>
            <span className="text-sm font-medium">Anexar do aparelho</span>
            <span className="text-[11px] text-muted-foreground">
              {allowMultiple ? "Selecione uma ou várias" : "Galeria ou arquivos"}
            </span>
          </button>
        </div>

        <div className="px-6 pb-5">
          <Button variant="ghost" className="w-full" onClick={onClose}>
            <X size={14} className="mr-1" /> Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
