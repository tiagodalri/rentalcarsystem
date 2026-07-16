import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Car,
  MessageCircle,
  FileCheck,
  UserCheck,
  Sparkles,
  MapPin,
  KeyRound,
} from "lucide-react";

/* ─── Data ─── */

type StepTag = { label: string; gold?: boolean };

type Step = {
  number: number;
  phaseLabel: string;
  title: string;
  description: string;
  highlight?: string;
  note?: string;
  tags: StepTag[];
  icon: React.ElementType;
  isStar?: boolean;
  isFinal?: boolean;
};

const steps: Step[] = [
  {
    number: 1,
    phaseLabel: "Antes da viagem",
    title: "Escolha o carro ideal",
    description:
      "Navegue pela frota e selecione o modelo perfeito para sua viagem. Casal, família ou grupo.",
    icon: Car,
    tags: [
      { label: "11 modelos" },
      { label: "2 a 7 passageiros" },
      { label: "SUV, esportivo, minivan" },
    ],
  },
  {
    number: 2,
    phaseLabel: "Antes da viagem",
    title: "Fale com a gente no WhatsApp",
    description:
      "Envie suas datas, o modelo escolhido e tire todas as dúvidas. Atendimento 100% em português, sem complicação.",
    highlight: "100% em português",
    icon: MessageCircle,
    tags: [
      { label: "Português nativo", gold: true },
      { label: "Resposta rápida" },
      { label: "Sem burocracia" },
    ],
  },
  {
    number: 3,
    phaseLabel: "Antes da viagem",
    title: "Confirme a reserva e viaje tranquilo",
    description:
      "Receba o contrato, confirme os detalhes e garanta seu veículo. Tudo resolvido antes de embarcar.",
    icon: FileCheck,
    tags: [
      { label: "CNH brasileira válida" },
      { label: "Passaporte" },
      { label: "Cartão de crédito" },
    ],
  },
  {
    number: 4,
    phaseLabel: "Chegou em Orlando",
    title: "Recepção VIP no aeroporto",
    description:
      "Ao desembarcar, um representante da Sua Marca estará na área de desembarque com uma plaquinha com seu nome. Sem fila, sem estresse.",
    highlight: "plaquinha com seu nome",
    isStar: true,
    icon: UserCheck,
    note: "A entrega também pode ser feita em hotel, resort, Airbnb ou onde preferir.",
    tags: [
      { label: "Plaquinha com seu nome", gold: true },
      { label: "Recepção no desembarque", gold: true },
    ],
  },
  {
    number: 5,
    phaseLabel: "Chegou em Orlando",
    title: "Carro limpo, higienizado e tanque cheio",
    description:
      "O representante te leva até o estacionamento onde o carro está pronto: lavado, higienizado e com o tanque cheio.",
    highlight: "lavado, higienizado e com o tanque cheio",
    icon: Sparkles,
    tags: [
      { label: "Lavado e higienizado", gold: true },
      { label: "Tanque cheio", gold: true },
      { label: "CarPlay configurado" },
    ],
  },
  {
    number: 6,
    phaseLabel: "Durante a viagem",
    title: "Aproveite com suporte a qualquer hora",
    description:
      "Parques, outlets, restaurantes, praias. Vá aonde quiser, na hora que quiser. A Sua Marca está a uma mensagem de distância.",
    highlight: "a uma mensagem de distância",
    icon: MapPin,
    tags: [
      { label: "Suporte 24h", gold: true },
      { label: "Autonomia total" },
    ],
  },
  {
    number: 7,
    phaseLabel: "Hora de voltar",
    title: "Devolução simples e assistida",
    description:
      "Um representante Sua Marca estará te esperando no aeroporto ou no local combinado. Entregue a chave e embarque tranquilo. Sem burocracia, sem taxas escondidas.",
    highlight: "no aeroporto ou no local combinado",
    isFinal: true,
    icon: KeyRound,
    tags: [
      { label: "Devolução assistida", gold: true },
      { label: "Sem taxas extras" },
    ],
  },
];

/* ─── Timeline Step ─── */

const TimelineStep = ({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = step.icon;
  const isEven = index % 2 === 0;

  const renderDescription = () => {
    if (!step.highlight) return step.description;
    const parts = step.description.split(step.highlight);
    return (
      <>
        {parts[0]}
        <span className="text-primary font-semibold">{step.highlight}</span>
        {parts[1]}
      </>
    );
  };

  return (
    <div ref={ref} className="relative">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[56px] bottom-0 w-px bg-gradient-to-b from-primary/30 via-border/40 to-border/20 hidden lg:block" />
      )}
      {!isLast && (
        <div className="absolute left-6 top-[56px] bottom-0 w-px bg-gradient-to-b from-primary/30 via-border/40 to-border/20 lg:hidden" />
      )}

      {/* Desktop: alternating layout */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_56px_1fr] lg:gap-6 items-start">
        {/* Left side */}
        <div className={isEven ? "" : "order-3"}>
          <motion.div
            initial={{ opacity: 0, x: isEven ? -30 : 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className={`group relative ${isEven ? "text-right" : "text-left"}`}
          >
            <div
              className={`relative rounded-xl overflow-hidden transition-all duration-400 bg-card/80 backdrop-blur-sm border group-hover:shadow-[0_4px_24px_hsl(0,0%,0%,0.15)] ${
                step.isFinal
                  ? "border-primary/30 shadow-[0_0_20px_hsl(45 79% 56% / 0.10)]"
                  : step.isStar
                  ? "border-primary/20 group-hover:border-primary/40"
                  : "border-border/50 group-hover:border-primary/25"
              }`}
            >
              <div
                className={`h-[2px] w-full ${
                  step.isFinal || step.isStar
                    ? "gold-gradient"
                    : "bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                }`}
              />
              <div className="p-5">
                <div className={`flex items-center gap-2 mb-1 ${isEven ? "justify-end" : "justify-start"}`}>
                  <span className="text-primary/50 text-[10px] font-bold tracking-[3px] uppercase">
                    Passo {String(step.number).padStart(2, "0")}
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-primary/30" />
                  <span className="text-muted-foreground/60 text-[10px] uppercase tracking-[2px] font-medium">
                    {step.phaseLabel}
                  </span>
                </div>

                {step.isStar && (
                  <p className={`text-[10px] text-primary font-semibold tracking-wider uppercase mb-1 ${isEven ? "text-right" : "text-left"}`}>
                    Experiência VIP
                  </p>
                )}

                <h3 className="text-base font-bold text-foreground leading-snug mb-2">{step.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                  {renderDescription()}
                </p>

                {step.note && (
                  <div className="bg-primary/[0.04] border border-primary/10 rounded-lg px-3 py-2 mb-3">
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed italic">{step.note}</p>
                  </div>
                )}

                <div className={`flex flex-wrap gap-1.5 ${isEven ? "justify-end" : "justify-start"}`}>
                  {step.tags.map((tag, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-2.5 py-1 rounded-md font-medium ${
                        tag.gold
                          ? "bg-primary/[0.08] text-primary border border-primary/15"
                          : "bg-muted/30 text-muted-foreground/70 border border-border/40"
                      }`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center: icon node */}
        <div className="flex flex-col items-center order-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.05, type: "spring", stiffness: 300 }}
            className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              step.isFinal
                ? "gold-gradient text-primary-foreground shadow-[0_0_20px_hsl(45 79% 56% / 0.28)]"
                : "bg-card border-2 border-primary/30 text-primary shadow-[0_0_16px_hsl(45 79% 56% / 0.12)]"
            }`}
          >
            <Icon size={20} />
          </motion.div>
        </div>

        {/* Right side (empty for even, content for odd) */}
        <div className={isEven ? "order-3" : ""} />
      </div>

      {/* Mobile: left-aligned timeline */}
      <div className="lg:hidden flex gap-4">
        {/* Icon node */}
        <div className="flex flex-col items-center flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.05, type: "spring", stiffness: 300 }}
            className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center ${
              step.isFinal
                ? "gold-gradient text-primary-foreground shadow-[0_0_16px_hsl(45 79% 56% / 0.28)]"
                : "bg-card border-2 border-primary/30 text-primary"
            }`}
          >
            <Icon size={18} />
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex-1 pb-8"
        >
          <div
            className={`group rounded-xl overflow-hidden transition-all duration-400 bg-card/80 backdrop-blur-sm border ${
              step.isFinal
                ? "border-primary/30"
                : step.isStar
                ? "border-primary/20"
                : "border-border/50"
            }`}
          >
            <div
              className={`h-[2px] w-full ${
                step.isFinal || step.isStar
                  ? "gold-gradient"
                  : "bg-gradient-to-r from-primary/30 via-transparent to-transparent"
              }`}
            />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-primary/50 text-[10px] font-bold tracking-[3px] uppercase">
                  {String(step.number).padStart(2, "0")}
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-primary/30" />
                <span className="text-muted-foreground/60 text-[10px] uppercase tracking-[2px] font-medium">
                  {step.phaseLabel}
                </span>
              </div>

              {step.isStar && (
                <p className="text-[10px] text-primary font-semibold tracking-wider uppercase mb-1">
                  Experiência VIP
                </p>
              )}

              <h3 className="text-sm font-bold text-foreground leading-snug mb-1.5">{step.title}</h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-2.5">
                {renderDescription()}
              </p>

              {step.note && (
                <div className="bg-primary/[0.04] border border-primary/10 rounded-lg px-3 py-2 mb-2.5">
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed italic">{step.note}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {step.tags.map((tag, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                      tag.gold
                        ? "bg-primary/[0.08] text-primary border border-primary/15"
                        : "bg-muted/30 text-muted-foreground/70 border border-border/40"
                    }`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ─── Main Section ─── */

const HowItWorksSection = () => {
  return (
    <section id="como-funciona" className="py-20 sm:py-32 relative overflow-hidden">
      <div className="absolute inset-0 section-divider" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10 sm:mb-14"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="section-eyebrow px-4 py-1.5 rounded-full border border-primary/20 bg-primary/[0.06]"
          >
            Como Funciona
          </motion.span>

          <h2 className="section-heading mt-1">
            Experiência{" "}
            <span className="gold-text italic font-black">concierge</span>
            <br className="hidden sm:block" />{" "}
            <span className="text-muted-foreground font-light">do início ao fim</span>
          </h2>

          <p className="section-subtitle">
            Você só precisa chegar.{" "}
            <span className="text-foreground font-medium">A Sua Marca cuida de todo o resto.</span>
          </p>
        </motion.div>


        {/* Timeline */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <TimelineStep key={step.number} step={step} index={i} isLast={i === steps.length - 1} />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mt-16 sm:mt-24"
        >
          <a
            href={`https://wa.me/15550000000?text=${encodeURIComponent("Olá, venho do site da Sua Marca e gostaria de realizar uma reserva!")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group/cta relative inline-flex items-center gap-3 px-10 py-4 rounded-xl text-sm font-bold uppercase tracking-[2px] transition-all duration-300"
          >
            <div className="absolute inset-0 rounded-xl gold-gradient opacity-90 group-hover/cta:opacity-100 transition-opacity" />
            <div className="absolute -inset-1 rounded-xl gold-gradient opacity-0 group-hover/cta:opacity-20 blur-lg transition-opacity duration-500" />
            <span className="relative z-10 flex items-center gap-3 text-primary-foreground">
              <MessageCircle size={18} />
              Quero reservar meu carro
            </span>
          </a>
          <p className="text-muted-foreground/40 text-xs mt-4 tracking-widest uppercase">
            Atendimento em português · Resposta em minutos
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
