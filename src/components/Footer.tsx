import { Instagram, MapPin, MessageCircle } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer id="contato" className="py-20 bg-background border-t border-border/10 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="flex justify-center">
          <BrandLogo size="xl" className="h-24 sm:h-28" />
        </div>

        <p className="mt-5 text-muted-foreground italic tracking-wide max-w-md mx-auto text-sm font-semibold">
          {t.footer.tagline}
        </p>

        <a
          href={`https://wa.me/15550000000?text=${encodeURIComponent("Olá, venho do site da GoDrive e gostaria de realizar uma reserva!")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-2.5 gold-gradient text-primary-foreground px-9 py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-primary/10"
        >
          <MessageCircle size={18} />
          {t.footer.whatsapp}
        </a>

        <div className="mt-10 flex items-center justify-center gap-8 text-muted-foreground text-sm">
          <a
            href="https://instagram.com/godriverental"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-primary transition-colors duration-300"
          >
            <Instagram size={18} />
            @godriverental
          </a>
          <span className="flex items-center gap-2">
            <MapPin size={18} className="text-primary/60" />
            Orlando, FL, EUA
          </span>
        </div>

        <div className="section-separator mt-10 mb-6 max-w-xs mx-auto" />

        <p className="text-xs text-muted-foreground/40 tracking-wide">
          {t.footer.rights}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
