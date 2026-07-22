import { useState, useEffect } from "react";
import { Menu, X, Globe, Home, Sun, Moon, User, Shield, Maximize, Minimize, Handshake } from "lucide-react";
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
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hidden = useHideOnScroll({ topOffset: 120, threshold: 12 });
  // Never hide when the mobile drawer is open.
  const shouldHide = hidden && !mobileOpen;

  // Lock body scroll while mobile menu is open.
  // iOS Safari fix: use position:fixed + top:-scrollY so the drawer (position:fixed)
  // doesn't get visually offset when the page was scrolled before opening.
  useEffect(() => {
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

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
    { label: t.nav.fleet, href: "/frota", isRoute: true },
    { label: t.nav.howItWorks, href: "#como-funciona" },
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 safe-top will-change-transform ${
        scrolled
          ? "bg-background/98 lg:bg-background/85 lg:backdrop-blur-xl border-b border-border/30 lg:shadow-lg lg:shadow-foreground/10"
          : "bg-transparent"
      } lg:!translate-y-0`}
      style={{
        transform: shouldHide ? "translateY(-110%)" : "translateY(0)",
      }}
    >
      <div
        className="container mx-auto relative flex items-center justify-between min-h-[56px] lg:min-h-0 lg:py-4 lg:px-8 gap-2"
        style={{
          // Padding lateral padronizado em mobile (px-4) e desktop (24px+),
          // somando safe-area do notch. Nunca aplicar safe-area nos ícones.
          paddingLeft: "max(1rem, calc(env(safe-area-inset-left, 0px) + 1rem))",
          paddingRight: "max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))",
        }}
      >

        <a
          href="/#"
          aria-label="Início"
          className="shrink-0 h-11 w-11 lg:h-auto lg:w-auto flex items-center justify-center rounded-full bg-muted/60 lg:bg-transparent text-muted-foreground hover:text-primary transition-colors duration-300 relative z-10"
        >
          <Home size={18} />
        </a>


        {/* Desktop links. centralizados absolutamente no meio da tela */}
        <div className="hidden lg:flex items-center gap-4 xl:gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {navLinks.map((link) =>
            link.isRoute ? (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                className="whitespace-nowrap text-[11px] xl:text-xs font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300"
              >
                {link.label}
              </button>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-[11px] xl:text-xs font-medium tracking-wider uppercase text-muted-foreground hover:text-primary transition-colors duration-300"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        {/* Ações à direita */}
        <div className="hidden lg:flex items-center gap-4 relative z-10">
          <button
            onClick={toggleFullscreen}
            className="text-muted-foreground hover:text-primary transition-colors duration-300"
            aria-label="Tela cheia"
            title="Tela cheia"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {/* Menu agrupado. tema, idioma, moeda, reservar, conta, admin */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors outline-none"
              aria-label="Abrir menu"
              title="Menu"
            >
              <Menu size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-background/95 backdrop-blur-xl border-border/40 min-w-[240px] p-1.5"
            >
              {/* Reservar. destaque no topo */}
              <a
                href="https://wa.me/16892981754"
                target="_blank"
                rel="noopener noreferrer"
                className="gold-gradient text-primary-foreground px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {t.nav.book}
              </a>

              <div className="my-1.5 border-t border-border/40" />

              {/* 1. Idioma */}
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                  <Globe size={12} /> Idioma
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`h-8 rounded-md text-sm flex items-center justify-center gap-1 transition-colors ${
                        language === lang
                          ? "bg-primary/15 text-primary font-semibold"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                      title={languageLabels[lang]}
                    >
                      <span>{languageFlags[lang]}</span>
                      <span className="text-[10px] uppercase">{lang}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Moeda */}
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-1.5">
                  Moeda
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {(["USD", "BRL"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => { if (currency !== c) toggleCurrency(); }}
                      className={`h-8 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                        currency === c
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Modo escuro */}
              <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer gap-2 px-2 py-2">
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                <span className="text-xs font-medium tracking-wider uppercase">
                  {theme === "dark" ? "Modo claro" : "Modo escuro"}
                </span>
              </DropdownMenuItem>

              <div className="my-1.5 border-t border-border/40" />

              {/* 4. Portal Cliente */}
              <DropdownMenuItem
                onClick={() => navigate(isLoggedIn ? "/minha-conta" : "/login")}
                className="cursor-pointer gap-2 px-2 py-2"
              >
                {isLoggedIn && user ? (
                  <>
                    <span className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center text-primary-foreground text-[9px] font-bold">
                      {user.name.charAt(0)}
                    </span>
                    <span className="text-xs font-medium tracking-wider uppercase">
                      {user.name.split(" ")[0]}
                    </span>
                  </>
                ) : (
                  <>
                    <User size={15} />
                    <span className="text-xs font-medium tracking-wider uppercase">Portal Cliente</span>
                  </>
                )}
              </DropdownMenuItem>

              {/* 5. Portal Admin */}
              <DropdownMenuItem
                onClick={() => navigate("/admin/login")}
                className="cursor-pointer gap-2 px-2 py-2"
              >
                <Shield size={15} />
                <span className="text-xs font-medium tracking-wider uppercase">Portal Admin</span>
              </DropdownMenuItem>

              {/* 6. Portal Parceiros */}
              <DropdownMenuItem
                onClick={() => navigate("/parceiro/login")}
                className="cursor-pointer gap-2 px-2 py-2"
              >
                <Handshake size={15} />
                <span className="text-xs font-medium tracking-wider uppercase">Portal Parceiros</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile. hambúrguer com mesma altura/área do ícone da esquerda */}
        <div className="flex lg:hidden items-center gap-2 shrink-0">
          <button
            className="h-11 w-11 flex items-center justify-center rounded-full bg-muted/60 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>



      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-background animate-fade-in flex flex-col"
          style={{
            height: "100dvh",
            paddingTop: "calc(env(safe-area-inset-top) + 4.5rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)",
            paddingLeft: "calc(env(safe-area-inset-left) + 1.25rem)",
            paddingRight: "calc(env(safe-area-inset-right) + 1.25rem)",
          }}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button. fixed top-right inside the drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="absolute h-10 w-10 flex items-center justify-center text-foreground rounded-full bg-muted active:bg-muted/70 transition-colors"
            style={{
              top: "calc(env(safe-area-inset-top) + 1rem)",
              right: "calc(env(safe-area-inset-right) + 1.25rem)",
            }}
          >
            <X size={20} />
          </button>

          <div className="flex-1 overflow-y-auto overscroll-contain pt-1 pb-2 space-y-4">

            {/* Reservar. destaque */}
            <a
              href="https://wa.me/16892981754"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="gold-gradient text-primary-foreground h-14 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
            >
              {t.nav.book}
            </a>

            {/* Navegação */}
            <div>
              <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground/70 px-1 mb-2">
                Navegação
              </div>
              <div className="rounded-2xl bg-muted overflow-hidden divide-y divide-border/50 border border-border/40">
                {navLinks.map((link) =>
                  link.isRoute ? (
                    <button
                      key={link.href}
                      onClick={() => { navigate(link.href); setMobileOpen(false); }}
                      className="w-full h-12 px-4 text-left text-sm font-medium tracking-wider uppercase text-foreground active:bg-background/60 transition-colors"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="w-full h-12 px-4 flex items-center text-sm font-medium tracking-wider uppercase text-foreground active:bg-background/60 transition-colors"
                    >
                      {link.label}
                    </a>
                  )
                )}
              </div>
            </div>

            {/* 1. Idioma */}
            <div>
              <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground/70 px-1 mb-2 flex items-center gap-1.5">
                <Globe size={11} /> Idioma
              </div>
              <div className="grid grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors border ${
                      language === lang
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border/40 active:bg-background/60"
                    }`}
                  >
                    <span className="text-base leading-none">{languageFlags[lang]}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider">{lang}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Moeda */}
            <div>
              <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground/70 px-1 mb-2">
                Moeda
              </div>
              <div className="h-14 rounded-2xl bg-muted border border-border/40 grid grid-cols-2 overflow-hidden">
                {(["USD", "BRL"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => { if (currency !== c) toggleCurrency(); }}
                    className={`flex items-center justify-center text-xs font-bold uppercase tracking-wider transition-colors ${
                      currency === c ? "bg-primary/15 text-primary" : "text-muted-foreground active:bg-background/60"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Modo escuro */}
            <button
              onClick={toggleTheme}
              className="w-full h-14 px-4 rounded-2xl bg-muted border border-border/40 active:bg-background/60 flex items-center gap-3 text-sm font-medium tracking-wider uppercase text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            </button>

            {/* 4. Portal Cliente */}
            <button
              onClick={() => { navigate(isLoggedIn ? "/minha-conta" : "/login"); setMobileOpen(false); }}
              className="w-full h-14 px-4 rounded-2xl bg-muted border border-border/40 active:bg-background/60 flex items-center gap-3 text-sm font-medium tracking-wider uppercase text-foreground transition-colors"
            >
              {isLoggedIn && user ? (
                <>
                  <span className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {user.name.charAt(0)}
                  </span>
                  <span>{user.name.split(" ")[0]}</span>
                </>
              ) : (
                <>
                  <User size={18} />
                  <span>Portal Cliente</span>
                </>
              )}
            </button>

            {/* 5. Portal Admin */}
            <button
              onClick={() => { navigate("/admin/login"); setMobileOpen(false); }}
              className="w-full h-14 px-4 rounded-2xl bg-muted border border-border/40 active:bg-background/60 flex items-center gap-3 text-sm font-medium tracking-wider uppercase text-foreground transition-colors"
            >
              <Shield size={18} />
              <span>Portal Admin</span>
            </button>

            {/* 6. Portal Parceiros */}
            <button
              onClick={() => { navigate("/parceiro/login"); setMobileOpen(false); }}
              className="w-full h-14 px-4 rounded-2xl bg-muted border border-border/40 active:bg-background/60 flex items-center gap-3 text-sm font-medium tracking-wider uppercase text-foreground transition-colors"
            >
              <Handshake size={18} />
              <span>Portal Parceiros</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

