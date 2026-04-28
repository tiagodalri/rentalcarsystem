import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import zeusLogo from "@/assets/zeus-logo-hd.png";
import { useLanguage } from "@/i18n/LanguageContext";
import SearchBar from "@/components/SearchBar";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-24 sm:pt-28 pb-8 sm:pb-12">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(40,100%,48%,0.06)_0%,_transparent_70%)]" />

      <svg className="absolute bottom-0 left-0 right-0 w-full opacity-10" viewBox="0 0 1440 200" fill="none">
        <path d="M0 200C240 100 480 50 720 80C960 110 1200 160 1440 120V200H0Z" fill="url(#goldGrad)" />
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1440" y2="0">
            <stop offset="0%" stopColor="hsl(40,100%,48%)" />
            <stop offset="100%" stopColor="hsl(47,100%,50%)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 container mx-auto px-4 text-center flex flex-col items-center gap-4 md:gap-6 lg:gap-8">
        {/* Logo */}
        <motion.img
          src={zeusLogo}
          alt="Zeus Rental Car"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="h-20 sm:h-28 md:h-32 lg:h-44 w-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_2px_16px_rgba(212,175,55,0.3)] dark:brightness-100 brightness-95 contrast-110"
        />

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-black uppercase tracking-tight leading-[1.15] max-w-5xl px-2"
        >
          {t.hero.title}
          <span className="gold-text">{t.hero.titleHighlight}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-xs sm:text-base md:text-lg lg:text-xl text-muted-foreground font-light tracking-wide max-w-2xl italic px-3 leading-relaxed"
        >
          {t.hero.subtitle}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center w-full max-w-sm sm:max-w-none px-4 sm:px-0"
        >
          <a
            href="#frota"
            className="gold-gradient text-primary-foreground px-6 py-3 md:px-9 md:py-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-primary/15 text-center"
          >
            {t.hero.exploreFleet}
          </a>
          <a
            href={`https://wa.me/16892981754?text=${encodeURIComponent("Olá, venho do site da Zeus e gostaria de realizar uma reserva!")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-primary/60 text-primary px-6 py-3 md:px-9 md:py-4 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all duration-300 backdrop-blur-sm text-center"
          >
            {t.hero.contactUs}
          </a>
        </motion.div>

        {/* Search Bar */}
        <SearchBar />
      </div>

      <motion.a
        href="#frota"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 cursor-pointer opacity-30 hover:opacity-60 transition-opacity duration-300"
      >
        <ChevronDown className="text-primary/50" size={24} />
      </motion.a>
    </section>
  );
};

export default HeroSection;
