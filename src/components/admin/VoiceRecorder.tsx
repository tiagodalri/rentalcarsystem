// Gravador de áudio estilo WhatsApp:
// - Toque curto (< 350ms): modo "mãos livres" (continua gravando, toque de novo p/ parar)
// - Pressionar e segurar: grava enquanto segurar; solta para parar
// - Visualização de waveform em tempo real (Web Audio API + AnalyserNode)
// - Transcrição ao vivo via Web Speech API (pt-BR)
// - Ao parar, edge 'polish-transcript' corrige gramática/pontuação sem alterar conteúdo
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  onTranscript: (text: string) => void;
  onFinal?: (text: string) => void;
  disabled?: boolean;
  language?: string;
  className?: string;
  fullWidth?: boolean;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const HOLD_THRESHOLD_MS = 350;
const NUM_BARS = 28;

export function VoiceRecorder({
  onTranscript,
  onFinal,
  disabled,
  language = "pt-BR",
  className,
  fullWidth = false,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(NUM_BARS).fill(0.08));

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const pressStartRef = useRef(0);
  const lockedRef = useRef(false);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Audio visualization
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>(Array(NUM_BARS).fill(0.08));

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      cleanupAudio();
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = () => {
    setElapsed(0);
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
  };
  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupAudio = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    historyRef.current = Array(NUM_BARS).fill(0.08);
    setBars(Array(NUM_BARS).fill(0.08));
  };

  const startVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // RMS para amplitude geral
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Amplifica e clamp
        const level = Math.min(1, Math.max(0.08, rms * 3.2));
        // Push novo nível, mantém histórico tipo waveform que rola
        historyRef.current = [...historyRef.current.slice(1), level];
        setBars(historyRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Falha ao iniciar visualização de áudio", e);
    }
  };

  const polish = async (raw: string): Promise<string> => {
    if (!raw.trim()) return raw;
    try {
      setPolishing(true);
      const { data, error } = await supabase.functions.invoke("polish-transcript", {
        body: { text: raw },
      });
      if (error) throw error;
      return (data?.text as string) || raw;
    } catch (e) {
      console.warn("polish failed, usando texto bruto", e);
      return raw;
    } finally {
      setPolishing(false);
    }
  };

  const beginRecording = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    finalTextRef.current = "";
    cancelledRef.current = false;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.onresult = (e: any) => {
      let interim = "";
      let finalAdd = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript || "";
        if (r.isFinal) finalAdd += txt;
        else interim += txt;
      }
      if (finalAdd) finalTextRef.current += finalAdd;
      const combined = (finalTextRef.current + " " + interim).trim();
      onTranscript(combined);
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") {
        toast.error("Permissão de microfone negada");
      }
      setRecording(false);
      setLocked(false);
      lockedRef.current = false;
      stopTimer();
      cleanupAudio();
    };
    rec.onend = async () => {
      setRecording(false);
      setLocked(false);
      lockedRef.current = false;
      stopTimer();
      cleanupAudio();
      const raw = finalTextRef.current.trim();
      if (cancelledRef.current || !raw) return;
      const polished = await polish(raw);
      onTranscript(polished);
      if (onFinal) onFinal(polished);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setRecording(true);
      startTimer();
      startVisualization();
    } catch {
      setRecording(false);
    }
  }, [language, onTranscript, onFinal]);

  const stopRecording = () => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    finalTextRef.current = "";
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    setRecording(false);
    setLocked(false);
    lockedRef.current = false;
    stopTimer();
    cleanupAudio();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || polishing) return;
    if (recording) return;
    e.preventDefault();
    pressStartRef.current = Date.now();
    beginRecording();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!recording) return;
    const held = Date.now() - pressStartRef.current;
    if (held < HOLD_THRESHOLD_MS) {
      lockedRef.current = true;
      setLocked(true);
      e.preventDefault();
      return;
    }
    stopRecording();
  };

  const onClick = () => {
    if (recording && lockedRef.current) stopRecording();
  };

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 cursor-not-allowed",
          className,
        )}
        title="Gravação por voz não suportada neste navegador"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // Barra de gravação estilo WhatsApp (não sobrepõe — ocupa sua própria linha)
  if (recording) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl bg-card border border-border shadow-sm pl-2 pr-1.5 py-1.5 animate-fade-in",
          fullWidth ? "w-full" : "",
          className,
        )}
      >
        <button
          type="button"
          onClick={cancelRecording}
          className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Cancelar gravação"
          aria-label="Cancelar gravação"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs tabular-nums text-foreground/80 shrink-0 min-w-[36px]">
          {mm}:{ss}
        </span>

        {/* Waveform. flex-1 para preencher espaço */}
        <div className="flex items-center gap-[2px] h-8 flex-1 min-w-0">
          {bars.map((b, i) => (
            <span
              key={i}
              className="flex-1 rounded-full bg-red-500/70"
              style={{
                height: `${Math.max(10, b * 100)}%`,
                transition: "height 60ms linear",
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-red-500 text-white shadow-md shadow-red-500/30 hover:bg-red-600 transition-colors touch-none"
          title={locked ? "Toque para parar e transcrever" : "Solte para parar"}
          aria-label="Parar gravação"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (fullWidth) {
    return (
      <button
        type="button"
        disabled={disabled || polishing}
        onPointerDown={onPointerDown}
        className={cn(
          "w-full h-11 rounded-xl flex items-center justify-center gap-2 transition-all touch-none select-none",
          "bg-card border border-border hover:bg-muted text-foreground text-sm font-medium",
          polishing && "opacity-60 cursor-wait",
          className,
        )}
        title={polishing ? "Corrigindo transcrição..." : "Toque (mãos livres) ou segure para gravar"}
        aria-label="Gravar áudio"
      >
        {polishing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Corrigindo transcrição...
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Ditar por voz
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || polishing}
      onPointerDown={onPointerDown}
      className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center transition-all touch-none select-none",
        "bg-muted hover:bg-muted/80 text-foreground",
        polishing && "opacity-60 cursor-wait",
        className,
      )}
      title={polishing ? "Corrigindo transcrição..." : "Toque (mãos livres) ou segure para gravar"}
      aria-label="Gravar áudio"
    >
      {polishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

