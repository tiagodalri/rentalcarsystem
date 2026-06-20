import { motion } from "framer-motion";
import { Globe, CheckCircle, Zap, Shield } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const icons = [Globe, CheckCircle, Zap, Shield];

const AboutSection = () => {
  const { t } = useLanguage();
  const features = [t.about.feat1, t.about.feat2, t.about.feat3, t.about.feat4];

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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {features.map((title, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card p-6 sm:p-8 text-center hover-lift hover:gold-border-glow group"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl gold-gradient flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Icon className="text-primary-foreground" size={24} strokeWidth={1.5} />
                </div>
                <p className="mt-4 card-title leading-snug">{title}</p>
              </motion.div>
            );
          })}
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
            href={`https://wa.me/16892981754?text=${encodeURIComponent("Olá, venho do site da Zeus e gostaria de realizar uma reserva!")}`}
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
