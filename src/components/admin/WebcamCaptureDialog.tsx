import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, X, Check, Play, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WebcamCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
  /** Endereço carimbado no preview ao vivo (e queimado na foto capturada). */
  stampAddress?: string;
}

import { formatStampDateOnly, formatStampTime } from "@/lib/inspectionStamp";


export function WebcamCaptureDialog({
  open,
  onClose,
  onCapture,
  title = "Capturar foto",
  stampAddress,
}: WebcamCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [needsTapToStart, setNeedsTapToStart] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [now, setNow] = useState(() => new Date());

  // Relógio para o overlay do carimbo.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(
    async (mode: "user" | "environment", silent = false) => {
      try {
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

    // Não queimamos carimbo aqui — o stampInspectionPhoto aplica o carimbo
    // novo (canto superior direito, grande e legível) após a captura.

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

  const showStampOverlay = !!stampAddress && !preview && ready;

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

          {/* Carimbo ao vivo — visível na pré-visualização da câmera. */}
          {showStampOverlay && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pt-10 pb-3 bg-gradient-to-t from-black/75 via-black/40 to-transparent text-right">
              <div className="text-[#FFD479] text-sm sm:text-base font-semibold tabular-nums tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {formatStampTime(now)}
              </div>
              <div className="text-white text-xs sm:text-sm font-semibold tabular-nums tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {formatStampDateOnly(now)}
              </div>
              <div className="mt-0.5 flex items-start justify-end gap-1.5 text-white text-xs sm:text-sm font-medium leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#FFD479]" strokeWidth={2} />
                <span className="line-clamp-2 max-w-[78%]">{stampAddress}</span>
              </div>
            </div>
          )}

          {/* Aviso quando endereço ainda não foi informado. */}
          {!stampAddress && !preview && ready && (
            <div className="pointer-events-none absolute top-2 right-2 bg-amber-500/90 text-black text-[10px] font-semibold px-2 py-1 rounded-md">
              Sem endereço para carimbo
            </div>
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
