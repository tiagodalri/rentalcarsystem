import { useState, useEffect } from "react";
import { Menu, X, Globe, Home, Sun, Moon, User, Shield, Maximize, Minimize } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useLanguage } from "@/i18n/LanguageContext";
import { useThemeMode } from "@/i18n/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/i18n/CurrencyContext";
import { Language, languageLabels, languageFlags } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const { isLoggedIn, user, loading: authLoading } = useAuth();
  const { currency, toggleCurrency } = useCurrency();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const navLinks = [
    { label: t.nav.fleet, href: "#frota" },
    { label: t.nav.howItWorks, href: "#como-funciona" },
    { label: t.nav.whyZeus, href: "#por-que" },
    { label: t.nav.about, href: "/sobre-nos", isRoute: true },
    { label: t.nav.contact, href: "#contato" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const languages: Language[] = ["pt", "en", "es", "it", "de", "fr"];

  const CurrencyToggle = ({ className = "" }: { className?: string }) => (
    <button
      onClick={toggleCurrency}
      className={`flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors duration-300 text-xs font-medium uppercase tracking-wider ${className}`}
      title="Alternar moeda"
    >
      <span className={currency === "USD" ? "text-primary font-bold" : ""}>USD</span>
      <span className="text-muted-foreground/40">/</span>
      <span className={currency === "BRL" ? "text-primary font-bold" : ""}>BRL</span>
    </button>
  );

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/30 shadow-lg shadow-foreground/10"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between py-4 px-4 lg:px-8">
        <a href="/#" className="text-muted-foreground hover:text-primary transition-colors duration-300">
          <Home size={20} />
        </a>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) =>
            link.isRoute ? (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                className="text-xs font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300"
              >
                {link.label}
              </button>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300"
              >
                {link.label}
              </a>
            )
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="text-muted-foreground hover:text-primary transition-colors duration-300"
            aria-label="Tela cheia"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-primary transition-colors duration-300"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors duration-300 outline-none">
              <Globe size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">{languageFlags[language]}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-background/95 backdrop-blur-xl border-border/40">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`cursor-pointer gap-2 ${language === lang ? "text-primary font-semibold" : ""}`}
                >
                  <span>{languageFlags[lang]}</span>
                  <span>{languageLabels[lang]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Currency Toggle */}
          <CurrencyToggle />

          <a
            href="https://wa.me/16892981754"
            target="_blank"
            rel="noopener noreferrer"
            className="gold-gradient text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-md shadow-primary/10"
          >
            {t.nav.book}
          </a>
          <button
            onClick={() => navigate("/admin/login")}
            className="flex items-center gap-1.5 text-muted-foreground/50 hover:text-primary transition-colors duration-300"
            title="Admin"
          >
            <Shield size={16} />
          </button>

          <button
            onClick={() => navigate(isLoggedIn ? "/minha-conta" : "/login")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors duration-300"
            title={t.nav.myBookings}
          >
            {authLoading ? (
              <span className="w-6 h-6 rounded-full bg-muted animate-pulse" />
            ) : isLoggedIn && user ? (
              <>
                <span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                  {user.name.charAt(0)}
                </span>
                <span className="text-xs font-medium tracking-wider">{user.name.split(" ")[0]}</span>
              </>
            ) : (
              <User size={18} />
            )}
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-background/95 backdrop-blur-xl border-t border-border/30 animate-fade-in">
          <div className="flex flex-col gap-4 px-6 py-6">
            {navLinks.map((link) =>
              link.isRoute ? (
                <button
                  key={link.href}
                  onClick={() => { navigate(link.href); setMobileOpen(false); }}
                  className="text-sm font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors text-left"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </a>
              )
            )}

            {/* Mobile theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300 pt-2 border-t border-border/30 w-full"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
            </button>

            {/* Mobile language switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300 outline-none pt-2 border-t border-border/30 w-full">
                <Globe size={16} />
                <span>Trocar idioma</span>
                <span className="ml-auto">{languageFlags[language]}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background/95 backdrop-blur-xl border-border/40">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`cursor-pointer gap-2 ${language === lang ? "text-primary font-semibold" : ""}`}
                  >
                    <span>{languageFlags[lang]}</span>
                    <span>{languageLabels[lang]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile currency toggle */}
            <CurrencyToggle className="pt-2 border-t border-border/30 w-full text-sm" />

            <a
              href="https://wa.me/16892981754"
              target="_blank"
              rel="noopener noreferrer"
              className="gold-gradient text-primary-foreground px-5 py-3 rounded-md text-sm font-bold uppercase tracking-wider text-center"
            >
              {t.nav.book}
            </a>

            <button
              onClick={() => { navigate(isLoggedIn ? "/minha-conta" : "/login"); setMobileOpen(false); }}
              className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300 pt-2 border-t border-border/30 w-full"
            >
              {isLoggedIn && user ? (
                <>
                  <span className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center text-primary-foreground text-[9px] font-bold">
                    {user.name.charAt(0)}
                  </span>
                  <span>{user.name.split(" ")[0]}</span>
                </>
              ) : (
                <>
                  <User size={16} />
                  <span>{t.nav.myBookings}</span>
                </>
              )}
            </button>

            <button
              onClick={() => { navigate("/admin/login"); setMobileOpen(false); }}
              className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase text-muted-foreground/50 hover:text-primary transition-colors duration-300 pt-2 border-t border-border/30 w-full"
            >
              <Shield size={16} />
              <span>Admin</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
