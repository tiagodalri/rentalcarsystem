import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import featSupport from "@/assets/feat-support-pt.png";
import featVehicles from "@/assets/feat-vehicles-checked.png";
import featEasy from "@/assets/feat-easy-process.png";
import featTrip from "@/assets/feat-trip-support.png";

const AboutSection = () => {
  const { t } = useLanguage();

  const features = [
    { img: featSupport, label: t.about.feat1, alt: "Atendimento em português" },
    { img: featVehicles, label: t.about.feat2, alt: "Veículos selecionados e revisados" },
    { img: featEasy, label: t.about.feat3, alt: "Processo simples e ágil" },
    { img: featTrip, label: t.about.feat4, alt: "Suporte durante toda a viagem" },
  ];

  return (
    <section id="quem-somos" className="py-16 sm:py-28 relative section-divider">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-20"
        >
          <h2 className="section-heading mb-4">
            {t.about.title}<span className="gold-text">{t.about.titleHighlight}</span>
          </h2>
          <p className="section-subtitle">
            {t.about.description}
          </p>
          <p className="mt-5 text-[14px] sm:text-[15px] font-semibold gold-text italic tracking-[0.04em]">
            {t.about.tagline}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {features.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden hover:border-primary/40 transition-colors"
            >
              {/* Ambient gold glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" aria-hidden />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/10 rounded-full blur-[60px] opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden />

              <div className="relative aspect-[4/3] flex items-center justify-center px-5 pt-5 sm:px-6 sm:pt-6">
                <img
                  src={item.img}
                  alt={item.alt}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  style={{ filter: "hue-rotate(95deg) saturate(0.75)" }}
                  className="max-h-full w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-2deg]"
                />
              </div>

              <div className="relative px-4 pb-5 pt-1 sm:px-5 sm:pb-6 text-center">
                <p className="card-eyebrow">
                  0{i + 1}
                </p>
                <p className="mt-1.5 card-title leading-snug">
                  {item.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTAs — moved from hero to keep search as the primary focus above the fold */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 sm:mt-14 flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md sm:max-w-none mx-auto"
        >
          <a
            href="#frota"
            className="w-full sm:w-auto gold-gradient text-primary-foreground px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-md shadow-primary/10 text-center"
          >
            {t.hero.exploreFleet}
          </a>
          <a
            href={`https://wa.me/15550000000?text=${encodeURIComponent("Olá, venho do site da GoDrive e gostaria de realizar uma reserva!")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto border border-primary/50 text-primary px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all duration-300 backdrop-blur-sm text-center"
          >
            {t.hero.contactUs}
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
