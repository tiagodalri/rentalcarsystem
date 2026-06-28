import { useNavigate } from "react-router-dom";
import { ArrowUpRight, LayoutDashboard, Gamepad2, Megaphone, Sparkles } from "lucide-react";
import hallImg from "@/assets/zeus-brain/hall-estrategico.jpg";
import simImg from "@/assets/zeus-brain/simulador.jpg";
import mktImg from "@/assets/zeus-brain/marketing-studio.jpg";
import iaImg from "@/assets/zeus-brain/zeus-ia.jpg";

export type HubModule = "painel" | "marketing" | "ia";

type Props = {
  onOpenPainel: () => void;
  onOpenMarketing: () => void;
  onOpenIa: () => void;
};

type Card = {
  key: "painel" | "simulador" | "marketing" | "ia";
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  Icon: typeof LayoutDashboard;
  badge?: string;
  action: () => void;
};

export default function AiHub({ onOpenPainel, onOpenMarketing, onOpenIa }: Props) {
  const navigate = useNavigate();

  const cards: Card[] = [
    {
      key: "painel",
      eyebrow: "Inteligência operacional",
      title: "Hall Estratégico",
      description: "Painel completo da frota. Receita, reservas, operação, dinheiro e recomendações em tempo real.",
      image: hallImg,
      Icon: LayoutDashboard,
      action: onOpenPainel,
    },
    {
      key: "simulador",
      eyebrow: "Frota Inteligente",
      title: "Simulador",
      description: "Simule cenários de compra e venda com base no histórico real de cada carro da sua frota.",
      image: simImg,
      Icon: Gamepad2,
      badge: "Interativo",
      action: () => navigate("/admin/zeus-brain/simulador"),
    },
    {
      key: "marketing",
      eyebrow: "Conteúdo e marca",
      title: "Marketing Studio",
      description: "Estúdio criativo da Zeus. Em breve: campanhas, posts, e-mails e materiais com identidade premium.",
      image: mktImg,
      Icon: Megaphone,
      badge: "Em breve",
      action: onOpenMarketing,
    },
    {
      key: "ia",
      eyebrow: "Assistente cognitivo",
      title: "Zeus IA",
      description: "Converse com a inteligência da Zeus. Tire dúvidas operacionais, peça análises e gere insights sob medida.",
      image: iaImg,
      Icon: Sparkles,
      badge: "Em breve",
      action: onOpenIa,
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4">
      {/* Hero */}
      <div className="text-center mb-4 sm:mb-5">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase font-semibold tracking-[0.32em]"
          style={{
            background: "rgba(13,29,46,0.04)",
            border: "1px solid rgba(13,29,46,0.10)",
            color: "rgba(13,29,46,0.62)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#9a7a3a" }} />
          Central de inteligência
        </div>
        <h1
          className="mt-2 text-[22px] sm:text-[26px] lg:text-[32px] leading-[1.1] font-light tracking-[-0.01em]"
          style={{ color: "#0d1d2e", fontFamily: "'Cormorant Garamond', 'Inter', serif" }}
        >
          Para onde vamos hoje?
        </h1>
        <p
          className="mt-1.5 mx-auto text-[11px] sm:text-[12.5px] leading-relaxed whitespace-nowrap"
          style={{ color: "rgba(13,29,46,0.62)" }}
        >
          Escolha um módulo do Zeus Brain. Cada espaço foi desenhado para uma frente da operação.
        </p>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {cards.map(({ key, eyebrow, title, description, image, Icon, badge, action }) => (
          <button
            key={key}
            onClick={action}
            className="group relative text-left rounded-[20px] overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-[0.995] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "#fbf7ee",
              border: "1px solid rgba(13,29,46,0.10)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -28px rgba(13,29,46,0.35)",
            }}
          >
            {/* Imagem */}
            <div className="relative h-28 sm:h-36 overflow-hidden">
              <img
                src={image}
                alt=""
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={1024}
                height={640}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
              />
              {/* Gradiente de leitura */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(13,29,46,0) 40%, rgba(13,29,46,0.20) 75%, rgba(13,29,46,0.55) 100%)",
                }}
              />
              {/* Eyebrow + badge sobre a imagem */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-semibold tracking-[0.22em] backdrop-blur-md"
                  style={{
                    background: "rgba(251,247,238,0.85)",
                    border: "1px solid rgba(13,29,46,0.10)",
                    color: "rgba(13,29,46,0.72)",
                  }}
                >
                  <Icon size={10} strokeWidth={1.75} style={{ color: "#9a7a3a" }} />
                  {eyebrow}
                </span>
                {badge && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase font-semibold tracking-[0.22em]"
                    style={{
                      background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                      color: "#d6bf86",
                      border: "1px solid rgba(214,191,134,0.40)",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="text-[16px] sm:text-[18px] leading-tight font-light tracking-[-0.005em]"
                  style={{ color: "#0d1d2e", fontFamily: "'Cormorant Garamond', 'Inter', serif" }}
                >
                  {title}
                </h3>
                <span
                  className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full transition-all group-hover:rotate-[-12deg]"
                  style={{
                    background: "linear-gradient(180deg, #14283d, #0d1d2e)",
                    color: "#d6bf86",
                    border: "1px solid rgba(214,191,134,0.40)",
                    boxShadow: "0 6px 14px -8px rgba(13,29,46,0.45)",
                  }}
                >
                  <ArrowUpRight size={13} strokeWidth={2} />
                </span>
              </div>
              <p
                className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-relaxed"
                style={{ color: "rgba(13,29,46,0.65)" }}
              >
                {description}
              </p>

              {/* Linha dourada */}
              <div
                className="mt-3 h-[1px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(154,122,58,0.45) 30%, rgba(154,122,58,0.65) 50%, rgba(154,122,58,0.45) 70%, transparent)",
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
