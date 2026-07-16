import { motion } from "framer-motion";
import { Percent, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const DealsSection = () => {
  const { t } = useLanguage();

  return (
    <section className="py-20 sm:py-28 relative">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <p className="section-eyebrow">
            <Sparkles size={12} strokeWidth={2.2} /> Vantagem GoDrive
          </p>
          <h2 className="section-heading">
            {t.deals.title}
            <span className="gold-text">{t.deals.titleHighlight}</span>
          </h2>
          <p className="section-subtitle">
            {t.deals.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Ambient glow */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/30 via-primary/5 to-primary/30 blur-[2px] opacity-60" aria-hidden />

          <div className="relative rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-xl overflow-hidden">
            <div className="absolute -top-20 -right-16 w-56 h-56 bg-primary/10 rounded-full blur-[70px]" aria-hidden />
            <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-primary/5 rounded-full blur-[70px]" aria-hidden />

            <div className="relative z-10 flex items-center gap-5 sm:gap-7 p-5 sm:p-8">
              {/* Big % icon */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 gold-gradient rounded-2xl blur-md opacity-50" aria-hidden />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gold-gradient flex items-center justify-center shadow-lg">
                  <Percent className="text-primary-foreground" size={30} strokeWidth={2.4} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 leading-none">
                  <span className="text-[40px] sm:text-[48px] font-black gold-text tabular-nums tracking-tight">
                    10%
                  </span>
                  <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                    OFF
                  </span>
                </div>
                <p className="card-body mt-2">
                  {t.deals.discount10}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 card-eyebrow border-t border-primary/15 pt-2.5">
                  <span className="w-1 h-1 rounded-full bg-primary" /> Aplicado automaticamente no checkout
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DealsSection;
