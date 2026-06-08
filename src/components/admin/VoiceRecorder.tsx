// Gravador de áudio com transcrição em tempo real via Web Speech API.
// Suportado em Chrome/Edge/Safari (inclui iOS 14.5+). Em navegadores sem suporte,
// o botão fica desabilitado com aviso.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onTranscript: (text: string) => void;
  onFinal?: (text: string) => void; // chamado quando para de gravar com transcrição final
  disabled?: boolean;
  language?: string;
  className?: string;
};

// Tipagens mínimas pro Web Speech API (não vem no TS por default)
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

export function VoiceRecorder({
  onTranscript,
  onFinal,
  disabled,
  language = "pt-BR",
  className,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState<boolean>(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef<string>("");

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // noop
      }
    };
  }, []);

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    finalTextRef.current = "";
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
    rec.onerror = () => {
      // silencioso — usuário verá que parou
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      const finalText = finalTextRef.current.trim();
      if (finalText && onFinal) onFinal(finalText);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // noop
    }
  };

  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className={cn("h-9", className)}
        title="Gravação por voz não suportada neste navegador. Use Chrome, Edge ou Safari."
      >
        <Mic className="h-4 w-4 mr-2" />
        Voz indisponível
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      size="sm"
      onClick={recording ? stop : start}
      disabled={disabled}
      className={cn("h-9 gap-2", recording && "animate-pulse", className)}
    >
      {recording ? (
        <>
          <Square className="h-4 w-4" />
          Parar gravação
        </>
      ) : (
        <>
          <Mic className="h-4 w-4" />
          Gravar áudio
        </>
      )}
    </Button>
  );
}
