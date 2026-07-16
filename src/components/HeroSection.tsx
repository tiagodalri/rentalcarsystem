import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useLanguage } from "@/i18n/LanguageContext";
import SearchBar from "@/components/SearchBar";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen min-h-[100svh] flex flex-col items-center justify-start overflow-hidden pt-28 sm:pt-32 pb-8 sm:pb-12 gap-3 sm:gap-4">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
      {/* Glow dourado deslocado para baixo. antes ficava bem atrás do logo e
          criava uma mancha esbranquiçada sobre ele. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_bottom,_hsl(45 79% 56% / 0.06)_0%,_transparent_65%)] pointer-events-none" />


      <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.14]" viewBox="0 0 1440 200" fill="none">
        <path d="M0 200C240 100 480 50 720 80C960 110 1200 160 1440 120V200H0Z" fill="url(#emeraldGrad)" />
        <defs>
          <linearGradient id="emeraldGrad" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stopColor="hsl(45 82% 56%)" />
            <stop offset="100%" stopColor="hsl(42 78% 50%)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 container mx-auto px-4 text-center flex flex-col items-center gap-3 sm:gap-5">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="h-16 sm:h-20 md:h-24 lg:h-28 flex items-center justify-center"
        >
          <BrandLogo size="xl" />
        </motion.div>

        {/* Editorial tagline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="flex items-center gap-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/90"
        >
          <span className="h-px w-6 sm:w-8 bg-primary/40" />
          Aluguel Premium · Orlando e Miami
          <span className="h-px w-6 sm:w-8 bg-primary/40" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="text-[16px] sm:text-[19px] md:text-2xl lg:text-[26px] font-black uppercase tracking-tight leading-[1.15] max-w-[18ch] sm:max-w-3xl lg:max-w-4xl px-2 lg:whitespace-nowrap text-balance"
        >
          {t.hero.title}
          <span className="gold-text">{t.hero.titleHighlight}</span>
        </motion.h1>

        {/* Subtitle. hidden on mobile to fit search bar above the fold */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="hidden sm:block text-xs sm:text-sm md:text-base text-muted-foreground font-light tracking-wide max-w-xl italic px-3 leading-relaxed"
        >
          {t.hero.subtitle}
        </motion.p>


        {/* Search Bar */}
        <SearchBar />
      </div>

      <motion.a
        href="#frota"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        className="hidden sm:block absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 cursor-pointer opacity-30 hover:opacity-60 transition-opacity duration-300"
      >
        <ChevronDown className="text-primary/50" size={24} />
      </motion.a>
    </section>
  );
};

export default HeroSection;
