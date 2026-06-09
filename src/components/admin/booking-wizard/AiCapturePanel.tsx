import { useState } from "react";
import { Upload, Sparkles, Loader2, FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { VoiceRecorder } from "@/components/admin/VoiceRecorder";
import type { AiExtractResult } from "./types";

interface Props {
  onExtracted: (data: AiExtractResult) => void;
  onSkip: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] || "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const LOADING_STEPS = [
  "Lendo o conteúdo...",
  "Identificando o cliente...",
  "Cruzando com a frota...",
  "Organizando datas e valores...",
];

export function AiCapturePanel({ onExtracted, onSkip }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const isAccepted = (f: File) => f.type.startsWith("image/") || f.type === "application/pdf";

  const handleFile = (f: File) => {
    if (!isAccepted(f)) {
      toast({ title: "Formato não suportado", description: "Envie imagem ou PDF.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file && !text.trim()) {
      toast({ title: "Anexe um arquivo, cole um texto ou grave um áudio", variant: "destructive" });
      return;
    }
    setExtracting(true);
    setLoadingStep(0);
    const tick = window.setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1200);
    try {
      const body: any = {};
      if (file) {
        body.imageBase64 = await fileToBase64(file);
        body.mimeType = file.type || "image/png";
      }
      if (text.trim()) body.text = text.trim();
      const { data, error } = await supabase.functions.invoke("extract-booking", { body });
      if (error) throw error;
      const result = (data?.data || {}) as AiExtractResult;
      toast({ title: "Dados extraídos", description: "Revise as etapas a seguir." });
      onExtracted(result);
    } catch (e: any) {
      toast({
        title: "Erro ao extrair",
        description: e.message || "Falha na IA",
        variant: "destructive",
      });
    } finally {
      window.clearInterval(tick);
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Auxiliar de IA
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">Vamos começar</h2>
        <p className="text-sm text-muted-foreground">
          Anexe prints/PDFs, cole o texto da conversa ou descreva por voz. A IA vai pré-preencher as próximas etapas.
        </p>
      </div>

      <section
        className={`rounded-2xl border-2 border-dashed p-6 transition-colors ${
          dragOver ? "border-primary bg-primary/10" : "border-primary/30 bg-primary/5"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!extracting) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = Array.from(e.dataTransfer.files || []).find(isAccepted);
          if (f) handleFile(f);
        }}
        onPaste={(e) => {
          const f = Array.from(e.clipboardData?.files || []).find(isAccepted);
          if (f) {
            e.preventDefault();
            handleFile(f);
          }
        }}
      >
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          <Sparkles size={22} className="text-primary" />
          <p className="text-sm font-medium">
            {dragOver ? "Solte o arquivo aqui" : "Arraste, cole (Ctrl+V) ou use os botões abaixo"}
          </p>
        </div>

        {file && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/50 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} className="text-primary shrink-0" />
              <span className="text-sm truncate">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Remover
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer h-11 px-3 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
            <Upload size={14} />
            Anexar arquivo
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={extracting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <Textarea
          placeholder="Cole aqui o texto do WhatsApp / e-mail / observação..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          disabled={extracting}
          className="bg-card resize-none"
        />

        <div className="mt-3">
          <VoiceRecorder
            language="pt-BR"
            fullWidth
            disabled={extracting}
            onFinal={(t) => setText((prev) => (prev ? prev + "\n" + t : t))}
          />
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          disabled={extracting}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular IA e preencher manualmente
        </button>
        <Button
          onClick={handleExtract}
          disabled={extracting || (!file && !text.trim())}
          className="h-11 px-6 rounded-xl"
        >
          {extracting ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              {LOADING_STEPS[loadingStep]}
            </>
          ) : (
            <>
              <Sparkles size={16} className="mr-2" />
              Interpretar com IA
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
