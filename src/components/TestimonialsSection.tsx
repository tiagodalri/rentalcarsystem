import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const TestimonialsSection = () => {
  const { t } = useLanguage();

  const testimonials = [
    { name: t.testimonials.t1Name, text: t.testimonials.t1Text },
    { name: t.testimonials.t2Name, text: t.testimonials.t2Text },
    { name: t.testimonials.t3Name, text: t.testimonials.t3Text },
    { name: t.testimonials.t4Name, text: t.testimonials.t4Text },
    { name: t.testimonials.t5Name, text: t.testimonials.t5Text },
    { name: t.testimonials.t6Name, text: t.testimonials.t6Text },
  ];

  return (
    <section className="py-28 relative section-divider">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 sm:mb-20"
        >
          <h2 className="section-heading">
            {t.testimonials.title}<span className="gold-text">{t.testimonials.titleHighlight}</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
          {testimonials.map((tm, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass-card p-6 sm:p-7 hover-lift"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={14} className="text-primary fill-primary" />
                ))}
              </div>
              <p className="card-body italic mb-5">"{tm.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-border/20">
                <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center">
                  <span className="text-[11px] font-bold text-primary-foreground">{tm.name[0]}</span>
                </div>
                <span className="text-[13px] sm:text-[14px] font-semibold tracking-[0.04em]">{tm.name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
