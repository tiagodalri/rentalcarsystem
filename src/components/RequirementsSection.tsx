import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import cnhImg from "@/assets/req-cnh.png";
import passportImg from "@/assets/req-passport.png";
import cardImg from "@/assets/req-card.png";

const RequirementsSection = () => {
  const { t } = useLanguage();

  const items = [
    { img: cnhImg, label: t.requirements.item1, alt: "Carteira de habilitação" },
    { img: passportImg, label: t.requirements.item2, alt: "Passaporte" },
    { img: cardImg, label: t.requirements.item3, alt: "Cartão de crédito" },
  ];

  return (
    <section className="py-24 sm:py-28 relative">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="section-heading">
            {t.requirements.title}
            <span className="gold-text">{t.requirements.titleHighlight}</span>
          </h2>
          <p className="section-subtitle italic">
            {t.requirements.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6"
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 * i }}
              className="group relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden hover:border-primary/40 transition-colors"
            >
              {/* Ambient gold glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" aria-hidden />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/10 rounded-full blur-[60px] opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden />

              <div className="relative aspect-[4/3] flex items-center justify-center px-6 pt-6">
                <img
                  src={item.img}
                  alt={item.alt}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="max-h-full w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-2deg]"
                />
              </div>

              <div className="relative px-5 pb-6 pt-2 text-center">
                <p className="card-eyebrow">
                  0{i + 1}
                </p>
                <p className="mt-1.5 card-title">
                  {item.label}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 sm:mt-12 card-body text-center max-w-xl mx-auto"
        >
          {t.requirements.footer}
        </motion.p>
      </div>
    </section>
  );
};

export default RequirementsSection;
