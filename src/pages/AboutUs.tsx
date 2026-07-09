import { motion } from "framer-motion";
import { ArrowLeft, Heart, Eye, Target, Shield, Star, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import Seo from "@/components/Seo";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1 },
  }),
};

const values = [
  {
    icon: Heart,
    title: "Acolhimento genuíno",
    text: "Cada cliente é recebido como alguém da família. Falamos a mesma língua, e não só o idioma. Entendemos a expectativa, a ansiedade e o sonho de cada viagem.",
  },
  {
    icon: Star,
    title: "Excelência nos detalhes",
    text: "Carro lavado, tanque cheio, plaquinha no aeroporto. O detalhe que parece pequeno é o que transforma uma locação em uma experiência.",
  },
  {
    icon: Target,
    title: "Superação como cultura",
    text: "Nascemos da garra. A história de Bruno e Vanessa é a prova de que é possível ir além. Esse espírito vive em cada entrega que fazemos.",
  },
  {
    icon: Shield,
    title: "Liberdade de verdade",
    text: "Ir onde quiser, quando quiser, sem depender de ninguém. Não alugamos carros. Entregamos autonomia para que cada momento da viagem seja escolha, não adaptação.",
  },
  {
    icon: Eye,
    title: "Confiança inabalável",
    text: "Sem surpresas, sem letras pequenas, sem taxas escondidas. A nossa palavra é o nosso contrato mais forte. Transparência não é diferencial. É obrigação.",
  },
  {
    icon: Flag,
    title: "Orgulho de ser brasileiro",
    text: "Levamos a hospitalidade, a alegria e a força do Brasil para cada interação. Mostramos que serviço premium e coração quente andam juntos.",
  },
];

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Seo
        title="Sobre Nós | Sua Marca Orlando"
        description="Conheça a Sua Marca: locadora premium em Orlando que une hospitalidade brasileira e padrão de serviço internacional. Confiança, transparência e excelência em cada detalhe."
        path="/sobre-nos"
      />
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="max-w-3xl"
          >
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-primary mb-4">
              Sua Marca
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider leading-tight mb-2">
              Sobre <span className="gold-text">Nós</span>
            </h1>
            <p className="text-lg text-muted-foreground uppercase tracking-widest font-medium">
              Cultura Organizacional
            </p>
          </motion.div>
        </div>
      </section>


      {/* Missão */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="text-3xl font-black uppercase tracking-wider mb-6">
                <span className="gold-text">Missão</span>
              </h2>
              <p className="text-lg font-semibold text-foreground mb-4">
                Transformar a mobilidade do brasileiro em Orlando numa experiência de acolhimento, liberdade e excelência.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Existimos para que nenhum brasileiro precise se adaptar, improvisar ou aceitar menos do que merece quando viaja. Oferecemos veículos premium, atendimento humano em português e um serviço concierge que começa antes do embarque e só termina quando a última memória da viagem está guardada.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              <h2 className="text-3xl font-black uppercase tracking-wider mb-6">
                <span className="gold-text">Visão</span>
              </h2>
              <p className="text-lg font-semibold text-foreground mb-4">
                Ser a primeira escolha de todo brasileiro que decide viver Orlando do jeito que ele merece.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Queremos que, quando alguém pensar em alugar carro em Orlando, pense primeiro na Sua Marca. Não pelo tamanho da frota, mas pela confiança. Não pelo preço mais baixo, mas pelo valor mais alto. Uma marca construída de brasileiro para brasileiro, com a excelência que o mundo reconhece e o calor humano que só a gente entende.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="py-20 section-divider">
        <div className="container mx-auto px-4">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-center mb-16"
          >
            Nossos <span className="gold-text">Valores</span>
          </motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="glass-card p-6 hover:gold-border-glow hover:scale-[1.02] transition-all duration-300"
              >
                <v.icon className="text-primary mb-4" size={28} />
                <h3 className="text-lg font-bold uppercase tracking-wider mb-3">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mb-10">
              <span className="gold-text">Manifesto</span>
            </h2>

            <div className="space-y-6 text-lg sm:text-xl leading-relaxed text-muted-foreground italic">
              <p className="text-foreground font-semibold not-italic text-2xl sm:text-3xl">
                A Sua Marca existe porque alguém decidiu que brasileiro em Orlando merece mais.
              </p>

              <p>
                Mais do que um carro. Mais do que uma chave. Merece ser recebido. Merece se sentir em casa. Merece dirigir a viagem que sempre sonhou, com conforto, com estilo, com alguém cuidando de cada detalhe nos bastidores.
              </p>

              <p className="text-foreground font-semibold">
                Bruno e Vanessa não construíram uma locadora. Construíram a experiência que gostariam de ter tido.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
      <WhatsAppBubble />
    </div>
  );
};

export default AboutUs;
