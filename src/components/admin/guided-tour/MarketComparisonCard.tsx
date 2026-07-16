import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const NAVY = "#0d1d2e";
const GOLD = "#9a7a3a";
const GOLD_SOFT = "rgba(154,122,58,0.12)";
const GOLD_BORDER = "rgba(154,122,58,0.55)";
const GOLD_DARK = "#7a5d2e";

type Row = { label: string; hint?: string };
type Section = { label: string; rows: Row[] };

const EXCLUSIVE_SECTIONS: Section[] = [
  {
    label: "Segurança da frota e da equipe",
    rows: [
      { label: "Rastreamento em tempo real com replay de trajeto" },
      { label: "Alerta de carro em movimento sem reserva" },
      { label: "Check-in de funcionário com selfie e motivo" },
      { label: "Prontuário individualizado de cada carro" },
    ],
  },
  {
    label: "Operação sem esforço",
    rows: [
      { label: "Vistoria pelo celular com IA", hint: "Lê odômetro e combustível direto da foto" },
      { label: "Cada vistoria chega no seu WhatsApp" },
      { label: "Resumo diário da operação no WhatsApp" },
    ],
  },
  {
    label: "Frota Inteligente",
    rows: [
      { label: "Lucro real por carro", hint: "Receita menos manutenção e custos" },
      { label: "Noites vazias com valor em dólar", hint: "O dinheiro invisível da sua frota" },
      { label: "IA recomenda qual carro trocar", hint: "Com projeção de ganho" },
    ],
  },
  {
    label: "Sua marca, entregue pronta",
    rows: [
      { label: "Sistema com a sua marca e o seu domínio", hint: "Não a marca do fornecedor" },
      { label: "Entrega chave na mão", hint: "Frota cadastrada, histórico importado, equipe treinada" },
    ],
  },
];

const BASIC_ROWS: Row[] = [
  { label: "Gestão de reservas e calendário" },
  { label: "Cadastro e controle da frota" },
  { label: "Contratos digitais e pagamentos" },
  { label: "Relatórios de receita" },
  { label: "Site com motor de reservas" },
  { label: "Acesso pelo celular" },
];

const EXCLUSIVE_COUNT = EXCLUSIVE_SECTIONS.reduce((s, sec) => s + sec.rows.length, 0);
const BASIC_COUNT = BASIC_ROWS.length;
const TOTAL_GODALS = EXCLUSIVE_COUNT + BASIC_COUNT;

function useReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => setShown(true), delay);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return { ref, shown };
}

function ComparisonRow({
  row,
  commonHas,
  index,
}: {
  row: Row;
  commonHas: boolean;
  index: number;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>(index * 40);
  return (
    <div
      ref={ref}
      className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 sm:gap-4 items-center px-3 sm:px-5 py-3 border-b transition-all duration-500"
      style={{
        borderColor: "rgba(13,29,46,0.06)",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <div>
        <div className="text-[13.5px] sm:text-[14.5px] font-medium leading-snug" style={{ color: NAVY }}>
          {row.label}
        </div>
        {row.hint && (
          <div className="text-[11.5px] sm:text-[12px] mt-0.5" style={{ color: "rgba(13,29,46,0.55)" }}>
            {row.hint}
          </div>
        )}
      </div>
      <div className="flex justify-center">
        {commonHas ? (
          <span
            className="inline-flex items-center justify-center h-6 w-6 rounded-full"
            style={{ background: "rgba(34,197,94,0.14)", color: "rgba(34,197,94,0.75)" }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center h-6 w-6 rounded-full"
            style={{ background: "rgba(239,68,68,0.14)", color: "#dc2626" }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="flex justify-center">
        <span
          className="inline-flex items-center justify-center h-7 w-7 rounded-full"
          style={{ background: "rgba(34,197,94,0.18)", color: "#16a34a", boxShadow: "0 0 0 3px rgba(34,197,94,0.08)" }}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 sm:px-5 pt-4 pb-2 text-[9.5px] sm:text-[10px] font-semibold tracking-[0.24em] uppercase"
      style={{ color: GOLD_DARK, background: "rgba(154,122,58,0.04)" }}
    >
      {children}
    </div>
  );
}

interface Props {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function MarketComparisonCard({ index, total, onPrev, onNext }: Props) {
  let rowCounter = 0;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative w-full max-w-5xl animate-fade-in"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #faf7f0 100%)",
        border: `1px solid rgba(154,122,58,0.35)`,
        borderRadius: 18,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)",
        padding: "clamp(22px, 4vw, 44px)",
      }}
    >
      <div className="mb-3">
        <span
          className="text-[10px] font-semibold tracking-[0.28em] uppercase"
          style={{ color: GOLD }}
        >
          Ato {index + 1} de {total} · Mercado
        </span>
      </div>

      <h2
        className="leading-[1.1] tracking-[-0.02em]"
        style={{
          color: NAVY,
          fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
          fontSize: "clamp(22px, 3vw, 34px)",
          fontWeight: 700,
          maxWidth: "26ch",
          textWrap: "balance",
        }}
      >
        O mercado vende sistemas.{" "}
        <span style={{ color: GOLD_DARK }}>A GoDalz entrega um cérebro para o seu negócio.</span>
      </h2>
      <p
        className="mt-3 leading-snug"
        style={{
          color: "rgba(13,29,46,0.7)",
          fontSize: "clamp(13.5px, 1.2vw, 15.5px)",
          maxWidth: "62ch",
        }}
      >
        Antes de começar, veja o que existe hoje no mercado — e o que só existe aqui.
      </p>

      {/* Tabela */}
      <div
        className="mt-6 rounded-2xl overflow-hidden"
        style={{
          border: `1px solid rgba(13,29,46,0.1)`,
          background: "#ffffff",
        }}
      >
        {/* Cabeçalho sticky */}
        <div
          className="sticky top-0 z-10 grid grid-cols-[1.6fr_1fr_1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-3 border-b backdrop-blur"
          style={{
            background: "rgba(255,255,255,0.96)",
            borderColor: "rgba(13,29,46,0.1)",
          }}
        >
          <div
            className="text-[10.5px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: NAVY }}
          >
            O que você recebe
          </div>
          <div
            className="text-center text-[10.5px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase"
            style={{ color: "rgba(13,29,46,0.55)" }}
          >
            Sistema comum
          </div>
          <div
            className="relative -mx-1 sm:-mx-2 rounded-lg px-2 py-1 text-center"
            style={{
              background: GOLD_SOFT,
              border: `1px solid ${GOLD_BORDER}`,
            }}
          >
            <div
              className="text-[10.5px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: GOLD_DARK }}
            >
              Ecossistema GoDalz
            </div>
            <div
              className="mx-auto mt-0.5 inline-block text-[9px] font-semibold tracking-[0.2em] uppercase px-1.5 py-[1px] rounded"
              style={{ background: GOLD_DARK, color: "#fff" }}
            >
              Exclusivo
            </div>
          </div>
        </div>

        {/* Exclusivos */}
        {EXCLUSIVE_SECTIONS.map((section) => (
          <div key={section.label}>
            <SectionLabel>{section.label}</SectionLabel>
            {section.rows.map((row) => {
              const i = rowCounter++;
              return <ComparisonRow key={row.label} row={row} commonHas={false} index={i} />;
            })}
          </div>
        ))}

        {/* Divisor */}
        <div className="relative my-2 py-6 flex items-center justify-center">
          <div
            className="absolute left-6 right-6 top-1/2 -translate-y-1/2"
            style={{
              borderTop: `1px dashed ${GOLD_BORDER}`,
            }}
          />
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full"
            style={{
              background: GOLD,
              boxShadow: `0 0 0 6px rgba(154,122,58,0.15)`,
              animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
            }}
          />
          <span
            className="relative px-4 py-1.5 rounded-full text-[10.5px] font-semibold tracking-[0.24em] uppercase"
            style={{
              background: "#fff",
              color: GOLD_DARK,
              border: `1px solid ${GOLD_BORDER}`,
            }}
          >
            E o básico? Também está dentro
          </span>
        </div>

        {/* Básicos */}
        {BASIC_ROWS.map((row) => {
          const i = rowCounter++;
          return <ComparisonRow key={row.label} row={row} commonHas={true} index={i} />;
        })}
      </div>

      {/* Placares */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          className="rounded-xl p-4 sm:p-5"
          style={{
            background: "rgba(13,29,46,0.04)",
            border: "1px solid rgba(13,29,46,0.12)",
          }}
        >
          <div className="flex items-baseline gap-3">
            <div
              className="tabular-nums leading-none"
              style={{
                color: "rgba(13,29,46,0.65)",
                fontFamily: "'Urbanist', 'Inter', sans-serif",
                fontSize: "clamp(34px, 4vw, 44px)",
                fontWeight: 800,
              }}
            >
              {BASIC_COUNT}
            </div>
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold leading-tight" style={{ color: NAVY }}>
                funções no sistema comum do mercado
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(13,29,46,0.55)" }}>
                só o básico
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-4 sm:p-5 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${GOLD_SOFT}, rgba(154,122,58,0.05))`,
            border: `1.5px solid ${GOLD_BORDER}`,
            boxShadow: "0 10px 30px -12px rgba(154,122,58,0.4)",
          }}
        >
          <div className="flex items-baseline gap-3">
            <div
              className="tabular-nums leading-none"
              style={{
                color: GOLD_DARK,
                fontFamily: "'Urbanist', 'Inter', sans-serif",
                fontSize: "clamp(34px, 4vw, 44px)",
                fontWeight: 800,
              }}
            >
              {TOTAL_GODALS}
            </div>
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold leading-tight" style={{ color: NAVY }}>
                funções no Ecossistema GoDalz
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: GOLD_DARK, fontWeight: 600 }}>
                {EXCLUSIVE_COUNT} que nenhum sistema do mercado oferece
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frase de fechamento */}
      <p
        className="mt-8 text-center leading-snug"
        style={{
          color: NAVY,
          fontFamily: "'Urbanist', 'Inter', sans-serif",
          fontSize: "clamp(18px, 2.2vw, 24px)",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        Isso não é um sistema.{" "}
        <span style={{ color: GOLD_DARK }}>É o cérebro do seu negócio.</span>
      </p>

      {/* Ações */}
      <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: NAVY,
            border: `1px solid rgba(13,29,46,0.25)`,
            background: "transparent",
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md text-[13px] font-semibold shadow-sm transition-transform hover:-translate-y-[1px]"
          style={{
            background: NAVY,
            color: GOLD,
            border: `1px solid ${GOLD}`,
          }}
        >
          Avançar
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <span
          className="ml-auto text-[11px] leading-tight text-right"
          style={{ color: "rgba(13,29,46,0.55)" }}
        >
          Clique fora do cartão para explorar esta tela ao vivo.
        </span>
      </div>

      <div
        className="mt-6 h-[3px] w-full rounded-full overflow-hidden"
        style={{ background: "rgba(13,29,46,0.08)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((index + 1) / total) * 100}%`,
            background: `linear-gradient(90deg, ${GOLD}, ${NAVY})`,
          }}
        />
      </div>
    </div>
  );
}
