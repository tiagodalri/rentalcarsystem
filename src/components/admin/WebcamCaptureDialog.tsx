import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, X, Check, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WebcamCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

/**
 * Webcam capture dialog (desktop + mobile PWA).
 *
 * iOS Safari/PWA requires getUserMedia to be called within a user gesture.
 * Quando o diálogo abre via state, o useEffect roda DEPOIS do paint e o iOS
 * pode invalidar o gesto. Por isso:
 *
 * 1) Tentamos iniciar a câmera automaticamente ao abrir (funciona desktop +
 *    Android + iOS Safari fora do PWA).
 * 2) Se a auto-inicialização falhar (NotAllowedError / gesto perdido),
 *    mostramos um botão "Iniciar câmera" que roda dentro do gesto do clique.
 */
export function WebcamCaptureDialog({
  open,
  onClose,
  onCapture,
  title = "Capturar foto",
}: WebcamCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [needsTapToStart, setNeedsTapToStart] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(
    async (mode: "user" | "environment", silent = false) => {
      try {
        // Para qualquer stream anterior antes de pedir um novo (evita conflito).
        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
          setNeedsTapToStart(false);
        }
      } catch (err: any) {
        const name = err?.name || "";
        // Erros de gesto/permissão: oferecer botão "Iniciar câmera" em vez de fechar.
        if (name === "NotAllowedError" || name === "SecurityError" || name === "AbortError") {
          setNeedsTapToStart(true);
          setReady(false);
          if (!silent) {
            toast({
              title: "Toque em Iniciar câmera",
              description: "O navegador precisa de uma confirmação para ligar a câmera.",
            });
          }
          return;
        }
        // Hardware ausente, em uso, etc. → fechar.
        toast({
          title: "Não foi possível acessar a câmera",
          description: err?.message || name || "Verifique as permissões do navegador.",
          variant: "destructive",
        });
        onClose();
      }
    },
    [onClose, stopStream]
  );

  // Tenta iniciar ao abrir; se falhar, mostra tap-to-start.
  useEffect(() => {
    if (!open) {
      stopStream();
      setPreview(null);
      setReady(false);
      setNeedsTapToStart(false);
      return;
    }
    startStream(facingMode, true);
    return () => stopStream();
  }, [open, facingMode, startStream, stopStream]);

  const snapshot = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL("image/jpeg", 0.92));
  };

  const confirm = async () => {
    if (!preview) return;
    const res = await fetch(preview);
    const blob = await res.blob();
    const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  };

  const retake = () => setPreview(null);
  const toggleCamera = () => setFacingMode((m) => (m === "user" ? "environment" : "user"));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-border">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-white text-sm font-medium">{title}</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-video flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Pré-visualização" className="w-full h-full object-contain" />
          ) : needsTapToStart ? (
            <button
              type="button"
              onClick={() => startStream(facingMode, false)}
              className="flex flex-col items-center gap-3 text-white/90 hover:text-white px-6 py-4 rounded-lg border border-white/20 hover:bg-white/5 transition-colors min-h-[44px]"
            >
              <Play className="h-10 w-10" strokeWidth={1.5} />
              <span className="text-sm font-medium">Iniciar câmera</span>
              <span className="text-xs text-white/60">Toque para permitir o acesso</span>
            </button>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 bg-background">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>

          <div className="flex items-center gap-2">
            {preview ? (
              <>
                <Button variant="outline" size="sm" onClick={retake}>
                  <RefreshCcw className="h-4 w-4 mr-1" /> Refazer
                </Button>
                <Button size="sm" onClick={confirm}>
                  <Check className="h-4 w-4 mr-1" /> Usar foto
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={toggleCamera} title="Alternar câmera" disabled={needsTapToStart}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={snapshot} disabled={!ready}>
                  <Camera className="h-4 w-4 mr-1" /> Capturar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
