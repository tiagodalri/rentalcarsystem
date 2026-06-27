import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SignedImage } from "./SignedImage";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  value: string | null;
  label?: string;
};

export function PhotoLightbox({ open, onClose, value, label }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[100vw] sm:max-w-3xl w-full p-0 bg-black border-none overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-2 right-2 z-20 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur"
        >
          <X size={20} />
        </button>
        {label && (
          <div className="absolute top-2 left-2 z-20 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur">
            {label}
          </div>
        )}
        <div className="w-full h-[90vh] flex items-center justify-center">
          {value && (
            <SignedImage
              value={value}
              alt={label || "Foto"}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
