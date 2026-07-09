import { useState } from "react";
import { ArrowLeft, Megaphone, Image as ImageIcon, Sparkles, FolderOpen } from "lucide-react";
import SocialPostGenerator from "./SocialPostGenerator";
import MarketingHistory from "./MarketingHistory";

type Props = { onBack: () => void };

type Tool = "social" | "history";

export default function MarketingStudio({ onBack }: Props) {
  const [tool, setTool] = useState<Tool | null>(null);

  if (tool === "social") {
    return <SocialPostGenerator onBack={() => setTool(null)} />;
  }
  if (tool === "history") {
    return <MarketingHistory onBack={() => setTool(null)} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.22em] font-semibold mb-4"
        style={{ color: "rgba(13,29,46,0.62)" }}
      >
        <ArrowLeft size={14} /> Voltar ao AI Studio
      </button>

      <div className="text-center mb-6">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase font-semibold tracking-[0.32em]"
          style={{
            background: "rgba(13,29,46,0.04)",
            border: "1px solid rgba(13,29,46,0.10)",
            color: "rgba(13,29,46,0.62)",
          }}
        >
          <Megaphone size={11} style={{ color: "#9a7a3a" }} />
          Marketing Studio
        </div>
        <h1
          className="mt-2 text-[24px] sm:text-[30px] font-light tracking-[-0.01em]"
          style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
        >
          O estudio criativo
        </h1>
        <p className="mt-1.5 text-[12.5px]" style={{ color: "rgba(13,29,46,0.62)" }}>
          Ferramentas para producao de conteudo com a identidade premium da marca.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => setTool("social")}
          className="group text-left rounded-[20px] overflow-hidden p-5 sm:p-6 transition-all hover:-translate-y-0.5"
          style={{
            background: "#fbf7ee",
            border: "1px solid rgba(13,29,46,0.10)",
            boxShadow: "0 18px 40px -28px rgba(13,29,46,0.35)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="inline-flex items-center justify-center h-10 w-10 rounded-full"
              style={{ background: "linear-gradient(180deg,#14283d,#0d1d2e)", color: "#d6bf86" }}
            >
              <ImageIcon size={18} strokeWidth={1.75} />
            </span>
            <span
              className="text-[9px] uppercase font-semibold tracking-[0.22em] px-2 py-0.5 rounded-full"
              style={{
                background: "linear-gradient(180deg,#14283d,#0d1d2e)",
                color: "#d6bf86",
                border: "1px solid rgba(214,191,134,0.40)",
              }}
            >
              IA
            </span>
          </div>
          <h3
            className="mt-3 text-[20px] font-light"
            style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
          >
            Posts para redes sociais
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "rgba(13,29,46,0.65)" }}>
            Gere artes em formato feed e story usando IA. Foto do carro tratada com tom cinematografico, logotipo da marca aplicado de forma estrategica e frases de impacto humanizadas.
          </p>
        </button>

        <button
          onClick={() => setTool("history")}
          className="group text-left rounded-[20px] overflow-hidden p-5 sm:p-6 transition-all hover:-translate-y-0.5"
          style={{
            background: "#fbf7ee",
            border: "1px solid rgba(13,29,46,0.10)",
            boxShadow: "0 18px 40px -28px rgba(13,29,46,0.35)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="inline-flex items-center justify-center h-10 w-10 rounded-full"
              style={{ background: "linear-gradient(180deg,#14283d,#0d1d2e)", color: "#d6bf86" }}
            >
              <FolderOpen size={18} strokeWidth={1.75} />
            </span>
            <span
              className="text-[9px] uppercase font-semibold tracking-[0.22em] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(13,29,46,0.06)",
                color: "rgba(13,29,46,0.62)",
                border: "1px solid rgba(13,29,46,0.12)",
              }}
            >
              Arquivo
            </span>
          </div>
          <h3
            className="mt-3 text-[20px] font-light"
            style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
          >
            Histórico de artes
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "rgba(13,29,46,0.65)" }}>
            Galeria com todas as artes ja geradas neste navegador. Reveja, baixe novamente ou copie a legenda quando quiser.
          </p>
        </button>

        <div
          className="rounded-[20px] p-5 sm:p-6 flex flex-col"
          style={{
            background: "#fbf7ee",
            border: "1px dashed rgba(13,29,46,0.18)",
            opacity: 0.7,
          }}
        >
          <span
            className="inline-flex items-center justify-center h-10 w-10 rounded-full"
            style={{ background: "rgba(13,29,46,0.06)", color: "rgba(13,29,46,0.55)" }}
          >
            <Sparkles size={18} strokeWidth={1.75} />
          </span>
          <h3
            className="mt-3 text-[20px] font-light"
            style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
          >
            Mais em breve
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "rgba(13,29,46,0.55)" }}>
            Campanhas de e-mail, scripts de WhatsApp, calendario editorial e banco de provas sociais.
          </p>
        </div>
      </div>
    </div>
  );
}
