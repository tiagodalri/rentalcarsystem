import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TourStep } from "./tourSteps";
import { PRICE_CONFIG, formatUSD } from "./priceConfig";

const NAVY = "#0d1d2e";
const GOLD = "#9a7a3a";
const GOLD_SOFT = "#d6bf86";
const OFFWHITE = "#f5f0eb";

interface Props {
  step: TourStep;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onStop: () => void;
  /** número atual da frota digitada no intro (fallback) */
  intoFleetCount: number;
}

/**
 * Sala de Fechamento: cartão escuro navy + dourado.
 * Renderiza as 7 telas de preço via step.priceVariant.
 * Números-ancora GIGANTES, contas pequenas, rótulos caixa-alta dourada.
 */
export default function PriceCard({
  step,
  index,
  total,
  onPrev,
  onNext,
  onStop,
  intoFleetCount,
}: Props) {
  const [N, setN] = useState<number>(intoFleetCount || 15);

  // Lê o tamanho real da frota montada na demo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("demo_presentation_state")
        .select("target_count")
        .maybeSingle();
      if (cancelled) return;
      const n = Number(data?.target_count);
      if (Number.isFinite(n) && n > 0) setN(n);
      else if (intoFleetCount > 0) setN(intoFleetCount);
      else setN(15);
    })();
    return () => {
      cancelled = true;
    };
  }, [step.id, intoFleetCount]);

  const C = PRICE_CONFIG;
  const perdaMin = N * C.economiaPorCarroAnoMin;
  const perdaMax = N * C.economiaPorCarroAnoMax;
  const totalImplantacao = N * C.implantacaoPorCarro;
  const totalManutencao = N * C.manutencaoPorCarroMes;

  const isDecision = step.priceVariant === "decision";
  const isLastPrice = index === total - 1;

  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-8 sm:py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          // click-fora fica com o Guided (aqui não temos hideOverlay). No-op.
        }
      }}
    >
      <div
        className="relative w-full max-w-3xl animate-fade-in"
        style={{
          background:
            "linear-gradient(180deg, #0a1420 0%, #0d1d2e 60%, #0a1420 100%)",
          border: `1px solid rgba(154,122,58,0.42)`,
          borderRadius: 20,
          boxShadow:
            "0 50px 100px -25px rgba(0,0,0,0.85), 0 0 0 1px rgba(154,122,58,0.10) inset",
          padding: "clamp(28px, 5vw, 56px)",
          color: OFFWHITE,
          fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif",
        }}
      >
        {/* faixa dourada superior */}
        <div
          className="absolute inset-x-10 top-0 h-[2px] rounded-b-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          }}
        />

        {/* rótulo do ato */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="text-[10px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: GOLD }}
          >
            Ato {index + 1} de {total} · {step.bullet}
          </span>
        </div>

        {/* Título */}
        <h2
          style={{
            color: OFFWHITE,
            fontSize: "clamp(22px, 3.2vw, 34px)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            maxWidth: "26ch",
            textWrap: "balance" as any,
          }}
        >
          {step.title}
        </h2>

        {/* Conteúdo por variante */}
        <div className="mt-8">{renderVariant(step.priceVariant, { N, perdaMin, perdaMax, totalImplantacao, totalManutencao, C })}</div>

        {/* CTA + Ações */}
        <div className="mt-10 flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onPrev}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-[13px] font-medium transition-colors"
            style={{
              color: "rgba(245,240,235,0.75)",
              border: "1px solid rgba(245,240,235,0.18)",
              background: "transparent",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          {isDecision ? (
            <button
              onClick={() => {
                toast.success("Ótima escolha. Vamos combinar os próximos passos.");
                onStop();
              }}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-md text-[14px] font-semibold transition-transform hover:-translate-y-[1px]"
              style={{
                background: GOLD,
                color: NAVY,
                border: `1px solid ${GOLD}`,
                boxShadow: `0 0 0 3px ${GOLD}33, 0 12px 30px -10px ${GOLD}88`,
              }}
            >
              <Sparkles className="h-4 w-4" />
              Quero o meu sistema
            </button>
          ) : (
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-md text-[13px] font-semibold transition-transform hover:-translate-y-[1px]"
              style={{
                background: GOLD,
                color: NAVY,
                border: `1px solid ${GOLD}`,
              }}
            >
              {isLastPrice ? "Encerrar" : "Avançar"}
              {!isLastPrice && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          )}

          <span
            className="ml-auto text-[11px] leading-tight text-right"
            style={{ color: "rgba(245,240,235,0.45)" }}
          >
            Clique fora do cartão para explorar esta tela ao vivo.
          </span>
        </div>

        {/* progresso */}
        <div
          className="mt-6 h-[3px] w-full rounded-full overflow-hidden"
          style={{ background: "rgba(245,240,235,0.08)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((index + 1) / total) * 100}%`,
              background: `linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Renderização por variante                                                 */
/* -------------------------------------------------------------------------- */

interface Vars {
  N: number;
  perdaMin: number;
  perdaMax: number;
  totalImplantacao: number;
  totalManutencao: number;
  C: typeof PRICE_CONFIG;
}

function renderVariant(v: TourStep["priceVariant"], x: Vars) {
  switch (v) {
    case "confirmacao":
      return (
        <div className="space-y-8">
          <Paragraph>
            Tudo isso que você viu. o controle, a gestão, a inteligência. faz sentido pra sua operação hoje?
          </Paragraph>
          <Paragraph>
            Ia te dar mais controle, mais segurança e mais lucro?
          </Paragraph>
        </div>
      );

    case "combined":
      return (
        <div className="space-y-8">
          <Paragraph>
            No final, eu só te peço uma decisão:
          </Paragraph>
          <div
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: GOLD_SOFT,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
            }}
          >
            SIM ou NÃO.
          </div>
          <Paragraph>
            Não tem problema nenhum se for não. Só não pode ser talvez, porque a condição que você vai ver é de agora.
          </Paragraph>
        </div>
      );

    case "investment":
      return (
        <div>
          <Label>O investimento</Label>
          <HugeNumber>{formatUSD(x.C.sistemaValor)}</HugeNumber>
          <Support>
            Um sistema de gestão de frota com inteligência artificial e
            métricas, construído e implantado do jeito certo. É o que vale uma
            plataforma que enxerga cada carro, cada custo e cada oportunidade.
          </Support>
        </div>
      );

    case "loss":
      return (
        <div>
          <Label>O que está te custando</Label>
          <div className="mt-2">
            <div
              style={{
                fontSize: "clamp(14px, 1.4vw, 16px)",
                color: "rgba(245,240,235,0.78)",
                marginBottom: 6,
              }}
            >
              A sua frota de{" "}
              <strong style={{ color: OFFWHITE }}>{x.N} carros</strong> está
              perdendo entre
            </div>
            <div
              style={{
                fontSize: "clamp(34px, 5.4vw, 56px)",
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
                color: GOLD_SOFT,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatUSD(x.perdaMin)}{" "}
              <span
                style={{
                  color: "rgba(245,240,235,0.55)",
                  fontWeight: 500,
                  fontSize: "0.55em",
                }}
              >
                a
              </span>{" "}
              {formatUSD(x.perdaMax)}
            </div>
            <div
              style={{
                fontSize: "clamp(13px, 1.2vw, 14px)",
                color: "rgba(245,240,235,0.6)",
                marginTop: 6,
              }}
            >
              por ano em dinheiro invisível. Em média,{" "}
              {formatUSD(x.C.economiaPorCarroAnoMin)} a{" "}
              {formatUSD(x.C.economiaPorCarroAnoMax)} por carro, por ano.
            </div>
          </div>

          <div className="mt-6">
            <Label>De onde vem</Label>
            <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
              {[
                "Diárias que somem nas janelas ociosas.",
                "O carro fraco que você sustenta sem ver.",
                "O lucro real de cada carro, escondido.",
                "Custos que ninguém somava.",
                "Em breve: compra pré-leilão, e essa perda vira ganho ainda maior.",
              ].map((t, i) => (
                <li
                  key={i}
                  className="flex gap-3 items-start"
                  style={{
                    fontSize: "clamp(13px, 1.15vw, 14.5px)",
                    color: "rgba(245,240,235,0.82)",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    aria-hidden
                    className="mt-[8px] shrink-0 rounded-full"
                    style={{ width: 5, height: 5, background: GOLD }}
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="mt-8 pt-6 border-t space-y-6"
            style={{ borderColor: "rgba(154,122,58,0.25)" }}
          >
            <Label>A conta</Label>

            <CalcRow label="O sistema custa">
              <span style={{ color: GOLD_SOFT, fontVariantNumeric: "tabular-nums" }}>
                {formatUSD(x.C.sistemaValor)}
              </span>
              <span
                className="ml-2"
                style={{ color: "rgba(245,240,235,0.55)", fontSize: "0.85em" }}
              >
                uma vez
              </span>
            </CalcRow>

            <CalcRow label={`Sua frota de ${x.N} carros para de perder`}>
              <span style={{ color: GOLD_SOFT, fontVariantNumeric: "tabular-nums" }}>
                {formatUSD(x.N * 988)}
              </span>
              <span
                className="mx-1.5"
                style={{ color: "rgba(245,240,235,0.45)", fontSize: "0.85em" }}
              >
                a
              </span>
              <span style={{ color: GOLD_SOFT, fontVariantNumeric: "tabular-nums" }}>
                {formatUSD(x.N * 1726)}
              </span>
              <span
                className="ml-2"
                style={{ color: "rgba(245,240,235,0.55)", fontSize: "0.85em" }}
              >
                por ano
              </span>
            </CalcRow>

            {(() => {
              const annualMin = x.N * 988;
              const annualMax = x.N * 1726;
              const mesesRapido = Math.ceil((x.C.sistemaValor / annualMax) * 12);
              const mesesLento = Math.ceil((x.C.sistemaValor / annualMin) * 12);
              const prefix = mesesLento <= 12 ? "Em menos de um ano: " : "";
              const same = mesesRapido === mesesLento;
              return (
                <div className="space-y-2">
                  <div
                    style={{
                      fontSize: "clamp(12px, 1.1vw, 13px)",
                      color: GOLD,
                      fontWeight: 600,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    Resultado
                  </div>
                  <div
                    style={{
                      fontSize: "clamp(22px, 3vw, 34px)",
                      fontWeight: 800,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      color: GOLD_SOFT,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {prefix}Você recupera o investimento em{" "}
                    <span style={{ color: GOLD }}>
                      {same ? mesesRapido : `${mesesRapido} a ${mesesLento}`}
                    </span>{" "}
                    {same && mesesRapido === 1 ? "mês." : "meses."}
                  </div>
                </div>
              );
            })()}

            <Paragraph>
              Depois disso, tudo é lucro limpo. E você pagou uma única vez.
            </Paragraph>
          </div>
        </div>
      );

    case "turn":
      return (
        <div className="space-y-5">
          <Paragraph>
            Estamos implantando o sistema aqui agora e montando o plano de crescimento.
          </Paragraph>
          <Paragraph>
            Por isso existe uma condição de fundador, só para as primeiras operações que entram com a gente.
          </Paragraph>
        </div>
      );

    case "founder":
      return (
        <div>
          <Label>De</Label>
          <div
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "rgba(245,240,235,0.42)",
              textDecoration: "line-through",
              textDecorationColor: "rgba(245,240,235,0.35)",
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            {formatUSD(x.C.sistemaValor)}
          </div>

          <div className="mt-4">
            <Label>Por</Label>
            <HugeNumber gold>
              {formatUSD(x.C.implantacaoPorCarro)}{" "}
              <span
                style={{
                  fontSize: "0.42em",
                  fontWeight: 500,
                  color: "rgba(245,240,235,0.65)",
                  letterSpacing: 0,
                }}
              >
                por carro
              </span>
            </HugeNumber>
          </div>

          <Support>
            O sistema inteiro, implantado, do seu jeito, uma única vez.
          </Support>

          <SmallMath>
            Sua frota: {x.N} × {formatUSD(x.C.implantacaoPorCarro)} ={" "}
            <strong style={{ color: GOLD_SOFT }}>
              {formatUSD(x.totalImplantacao)}
            </strong>
            . Aproximadamente 5 diárias por carro.
          </SmallMath>
        </div>
      );

    case "maintenance":
      return (
        <div>
          <Label>A manutenção</Label>
          <HugeNumber>
            {formatUSD(x.C.manutencaoPorCarroMes)}{" "}
            <span
              style={{
                fontSize: "0.42em",
                fontWeight: 500,
                color: "rgba(245,240,235,0.65)",
                letterSpacing: 0,
              }}
            >
              por carro, por mês
            </span>
          </HugeNumber>
          <Support>Menos de $0,50 por dia, por carro.</Support>
          <SmallMath>
            Sua frota: {x.N} × {formatUSD(x.C.manutencaoPorCarroMes)} ={" "}
            <strong style={{ color: GOLD_SOFT }}>
              {formatUSD(x.totalManutencao)}
            </strong>
            /mês. 1 diária paga 3 meses daquele carro, e ainda sobra troco.
          </SmallMath>
        </div>
      );

    case "decision":
      return (
        <div className="space-y-10">
          <div className="space-y-4">
            <BigLabel>SE FOR SIM</BigLabel>
            <Paragraph>
              Parabéns. Você acaba de colocar na sua frota o melhor sistema de
              administração de locadoras, com inteligência artificial e métricas
              de verdade. Contrato digital e pagamento agora, implantação
              agendada na hora.
            </Paragraph>
          </div>
          <div
            className="pt-8 border-t space-y-4"
            style={{ borderColor: "rgba(154,122,58,0.25)" }}
          >
            <BigLabel>SE FOR NÃO</BigLabel>
            <Paragraph>
              Tudo bem, seguimos juntos do mesmo jeito. Só não consigo te
              garantir esse valor: a cada operação que fecha, o preço sobe,
              porque o alvo do sistema é chegar nos {formatUSD(x.C.sistemaValor)}
              . Quem entra agora, entra como fundador.
            </Paragraph>
          </div>
        </div>
      );
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Primitivos                                                                */
/* -------------------------------------------------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold tracking-[0.32em] uppercase mb-2"
      style={{ color: GOLD }}
    >
      {children}
    </div>
  );
}

function BigLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-semibold tracking-[0.28em] uppercase"
      style={{ color: GOLD }}
    >
      {children}
    </div>
  );
}

function CalcRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className="text-[10px] font-semibold tracking-[0.28em] uppercase"
        style={{ color: GOLD }}
      >
        {label}
      </div>
      <div
        className="text-[clamp(18px,2.2vw,26px)] font-bold leading-tight"
        style={{
          color: OFFWHITE,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HugeNumber({
  children,
  gold,
}: {
  children: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: "clamp(48px, 8vw, 96px)",
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        color: gold ? GOLD_SOFT : OFFWHITE,
        fontVariantNumeric: "tabular-nums",
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function Support({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-5"
      style={{
        color: "rgba(245,240,235,0.78)",
        fontSize: "clamp(14.5px, 1.4vw, 16.5px)",
        lineHeight: 1.55,
        maxWidth: "62ch",
      }}
    >
      {children}
    </p>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "rgba(245,240,235,0.85)",
        fontSize: "clamp(15px, 1.5vw, 17.5px)",
        lineHeight: 1.55,
        maxWidth: "62ch",
      }}
    >
      {children}
    </p>
  );
}

function SmallMath({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-5 pt-4 border-t"
      style={{
        borderColor: "rgba(154,122,58,0.25)",
        color: "rgba(245,240,235,0.65)",
        fontSize: "clamp(12.5px, 1.1vw, 13.5px)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.55,
        maxWidth: "62ch",
      }}
    >
      {children}
    </p>
  );
}
