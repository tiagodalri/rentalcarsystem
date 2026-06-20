import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import imgVehicles from "@/assets/why-vehicles.png";
import imgPortuguese from "@/assets/why-portuguese.png";
import imgProcess from "@/assets/why-process.png";
import imgSupport from "@/assets/why-support.png";

const WhyZeusSection = () => {
  const { t } = useLanguage();

  const benefits = [
    {
      img: imgVehicles,
      title: t.whyZeus.benefit1Title,
      desc: t.whyZeus.benefit1Desc,
      alt: "Veículos selecionados",
    },
    {
      img: imgPortuguese,
      title: t.whyZeus.benefit2Title,
      desc: t.whyZeus.benefit2Desc,
      alt: "Atendimento em português",
    },
    {
      img: imgProcess,
      title: t.whyZeus.benefit3Title,
      desc: t.whyZeus.benefit3Desc,
      alt: "Processo simples e ágil",
    },
    {
      img: imgSupport,
      title: t.whyZeus.benefit4Title,
      desc: t.whyZeus.benefit4Desc,
      alt: "Suporte durante toda a viagem",
    },
  ];

  return (
    <section id="por-que" className="py-16 sm:py-28 relative section-divider">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-20"
        >
          <h2 className="section-heading">
            {t.whyZeus.title}<span className="gold-text">{t.whyZeus.titleHighlight}</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden hover:border-primary/40 transition-colors"
            >
              {/* Ambient gold glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" aria-hidden />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/10 rounded-full blur-[60px] opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden />

              <div className="relative aspect-[16/10] flex items-center justify-center px-6 pt-6 sm:px-8 sm:pt-8">
                <img
                  src={b.img}
                  alt={b.alt}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="max-h-full w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-2deg]"
                />
              </div>

              <div className="relative px-5 pb-6 pt-2 sm:px-6 sm:pb-7 text-center">
                <p className="card-eyebrow">0{i + 1}</p>
                <h3 className="card-title mt-2 mb-2.5">{b.title}</h3>
                <p className="card-body">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyZeusSection;
