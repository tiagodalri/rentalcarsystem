import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WebcamCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

/**
 * Desktop/notebook webcam capture dialog.
 * Uses getUserMedia to stream the device webcam, then converts a still frame
 * into a JPEG File that mirrors what the mobile native camera produces.
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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // Start/stop camera with dialog
  useEffect(() => {
    if (!open) {
      stopStream();
      setPreview(null);
      setReady(false);
      return;
    }
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  const startStream = async (mode: "user" | "environment") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível acessar a câmera",
        description: err?.message || "Verifique as permissões do navegador.",
        variant: "destructive",
      });
      onClose();
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

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
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
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
                <Button variant="outline" size="sm" onClick={toggleCamera} title="Alternar câmera">
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
