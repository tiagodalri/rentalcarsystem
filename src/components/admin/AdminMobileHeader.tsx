import { MoreVertical, Sun, Moon, Maximize2, Minimize2, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useThemeMode } from "@/i18n/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAdminPageTitle } from "@/hooks/useAdminPageTitle";

const LANG_OPTIONS: Array<{ code: "pt" | "en" | "es" | "fr" | "de" | "it"; label: string }> = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

export function AdminMobileHeader() {
  const title = useAdminPageTitle();
  const { theme, toggleTheme } = useThemeMode();
  const { language, setLanguage } = useLanguage() as any;
  const [isFs, setIsFs] = useState(false);
  const [fsSupported, setFsSupported] = useState(true);

  useEffect(() => {
    const doc: any = document;
    setFsSupported(!!(doc.documentElement.requestFullscreen || doc.documentElement.webkitRequestFullscreen));
    const onChange = () => setIsFs(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFs = () => {
    const doc: any = document;
    const el: any = document.documentElement;
    if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      (el.requestFullscreen?.() || el.webkitRequestFullscreen?.())?.catch?.(() => {});
    } else {
      (doc.exitFullscreen?.() || doc.webkitExitFullscreen?.())?.catch?.(() => {});
    }
  };

  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center gap-1 px-2 h-14 bg-background/95 backdrop-blur-md"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 4px)",
        boxShadow: "inset 0 -1px 0 hsl(var(--border) / 0.6)",
      }}
    >
      <SidebarTrigger className="admin-icon-btn" aria-label="Abrir menu" />
      <h1 className="flex-1 min-w-0 truncate text-[15px] font-medium tracking-tight text-foreground">
        {title}
      </h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Mais opções"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-56">
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </DropdownMenuItem>
          {fsSupported && (
            <DropdownMenuItem onClick={toggleFs}>
              {isFs ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
              {isFs ? "Sair da tela cheia" : "Tela cheia"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3 w-3" /> Idioma
          </DropdownMenuLabel>
          {LANG_OPTIONS.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => setLanguage?.(l.code)}
              className={language === l.code ? "font-semibold" : undefined}
            >
              {l.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
