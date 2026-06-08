// Gravador de áudio estilo WhatsApp:
// - Toque curto (< 350ms) no microfone: ATIVA modo "mãos livres" (continua gravando até tocar novamente)
// - Pressionar e segurar: grava enquanto segurar; solta para parar
// - Live transcript via Web Speech API (pt-BR)
// - Ao parar, envia para edge function 'polish-transcript' que corrige gramática/pontuação
//   sem alterar o conteúdo (datas, nomes, valores preservados).
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  onTranscript: (text: string) => void;
  onFinal?: (text: string) => void;
  disabled?: boolean;
  language?: string;
  className?: string;
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

export function VoiceRecorder({
  onTranscript,
  onFinal,
  disabled,
  language = "pt-BR",
  className,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false); // modo mãos-livres (tap curto)
  const [polishing, setPolishing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const pressStartRef = useRef<number>(0);
  const lockedRef = useRef(false);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
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
    };
    rec.onend = async () => {
      setRecording(false);
      setLocked(false);
      lockedRef.current = false;
      stopTimer();
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
  };

  // Hold-to-talk handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || polishing) return;
    if (recording) return; // se já gravando (locked), tap trata no click
    e.preventDefault();
    pressStartRef.current = Date.now();
    beginRecording();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!recording) return;
    const held = Date.now() - pressStartRef.current;
    if (held < HOLD_THRESHOLD_MS) {
      // tap curto: trava em modo mãos-livres
      lockedRef.current = true;
      setLocked(true);
      e.preventDefault();
      return;
    }
    // segurou: solta = para
    stopRecording();
  };

  const onPointerLeave = () => {
    // se segurando e arrastar para fora, mantém gravando (deixa o user usar stop button)
  };

  const onClick = () => {
    // Quando travado, clique para parar
    if (recording && lockedRef.current) {
      stopRecording();
    }
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

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {recording && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="tabular-nums">{mm}:{ss}</span>
          <button
            type="button"
            onClick={cancelRecording}
            className="ml-1 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={disabled || polishing}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-all touch-none select-none",
          recording
            ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30"
            : "bg-muted hover:bg-muted/80 text-foreground",
          polishing && "opacity-60 cursor-wait",
        )}
        title={
          polishing
            ? "Corrigindo transcrição..."
            : recording
              ? (locked ? "Toque para parar" : "Solte para parar")
              : "Toque (mãos livres) ou segure para gravar"
        }
        aria-label="Gravar áudio"
      >
        {polishing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className={cn("h-4 w-4", recording && "animate-pulse")} />
        )}
      </button>
    </div>
  );
}
