import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadWhatsAppMedia } from "@/lib/whatsappMedia";
import {
  sendWhatsAppAudio,
  isNotConfigured,
  isDeviceOffline,
} from "@/lib/zapi";

interface Props {
  phone: string;
  conversationId: string;
  disabled?: boolean;
}

/**
 * Mic button that records audio via MediaRecorder + shows a live waveform
 * using AnalyserNode. On stop, uploads and calls send-audio.
 */
export function AudioRecorderButton({ phone, conversationId, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (ctxRef.current && ctxRef.current.state !== "closed") ctxRef.current.close().catch(() => {});
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    analyserRef.current = null;
  }

  async function start() {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AC: typeof AudioContext =
        window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).webkitAudioContext as typeof AudioContext);
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => finalize();
      rec.start();

      setRecording(true);
      setElapsed(0);
      setLevels([]);

      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      tick();
    } catch (err) {
      console.error("[wa] mic denied", err);
      toast.error("Permissão de microfone negada");
      cleanup();
    }
  }

  function tick() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    // amplitude 0..1
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.min(1, Math.sqrt(sum / buf.length) * 2.2);
    setLevels((prev) => {
      const next = [...prev, rms];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
    rafRef.current = requestAnimationFrame(() => setTimeout(tick, 90));
  }

  function stop(cancel: boolean) {
    cancelledRef.current = cancel;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else finalize();
  }

  async function finalize() {
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const wasCancelled = cancelledRef.current;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    cleanup();
    if (wasCancelled || blob.size === 0) return;

    const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
    setSending(true);
    try {
      const uploaded = await uploadWhatsAppMedia(file);
      const res = await sendWhatsAppAudio(phone, uploaded.signedUrl, conversationId);
      if (res.ok && res.simulated) {
        toast.success("Áudio enviado", { description: "Modo demonstração." });
      } else if (res.ok) {
        toast.success("Áudio enviado");
      } else if (isNotConfigured(res)) {
        toast.error("Integração não configurada");
      } else if (isDeviceOffline(res)) {
        toast.error("Celular offline");
      } else {
        toast.error("Falha ao enviar áudio");
      }
    } catch (err) {
      console.error("[wa] audio send failed", err);
      toast.error("Falha ao enviar áudio");
    } finally {
      setSending(false);
    }
  }

  if (sending) {
    return (
      <Button
        type="button" variant="ghost" size="icon"
        className="h-10 w-10 shrink-0 rounded-full text-primary"
        disabled
      >
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  if (!recording) {
    return (
      <Button
        type="button" variant="ghost" size="icon"
        className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary"
        title="Gravar áudio"
        onClick={start}
        disabled={disabled}
      >
        <Mic className="w-5 h-5" />
      </Button>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 flex-1 rounded-full bg-primary/10 border border-primary/30 pl-2 pr-1 py-1">
      <button
        type="button"
        onClick={() => stop(true)}
        className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
        title="Cancelar"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="flex-1 flex items-center gap-[2px] h-8 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => {
          const v = levels[i] ?? 0;
          const h = Math.max(3, Math.round(v * 28));
          return (
            <span
              key={i}
              className="w-[3px] rounded-full bg-primary/70 transition-[height] duration-75"
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      <span className="text-[11px] tabular-nums text-primary font-medium px-1">
        {mm}:{ss}
      </span>

      <button
        type="button"
        onClick={() => stop(false)}
        className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
        title="Enviar"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
