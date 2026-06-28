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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-w-6xl mx-auto">
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
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary/10 rounded-full blur-[40px] opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden />

              <div className="relative flex items-center justify-center px-2 pt-3 pb-1 sm:px-3 sm:pt-4">
                <img
                  src={b.img}
                  alt={b.alt}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="h-11 sm:h-14 w-auto object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.14)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-2deg]"
                />
              </div>

              <div className="relative px-2 pb-3 pt-0.5 sm:px-3 sm:pb-4 text-center">
                <p className="card-eyebrow text-[10px] sm:text-xs">0{i + 1}</p>
                <h3 className="card-title text-xs sm:text-sm mt-1 mb-1 leading-tight">{b.title}</h3>
                <p className="card-body text-[11px] sm:text-xs leading-relaxed">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyZeusSection;
