import { MoreVertical, Sun, Moon, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeMode } from "@/i18n/ThemeContext";
import { useAdminPageTitle } from "@/hooks/useAdminPageTitle";
import { useAdminFab } from "@/hooks/useAdminFab";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { haptic } from "@/lib/haptic";

export function AdminMobileHeader() {
  const title = useAdminPageTitle();
  const { theme, toggleTheme } = useThemeMode();
  const { fab } = useAdminFab();
  const FabIcon = fab?.icon;
  const [isFs, setIsFs] = useState(false);
  const [fsSupported, setFsSupported] = useState(true);
  const hidden = useHideOnScroll({ topOffset: 60, threshold: 10 });

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
      className="lg:hidden sticky top-0 z-30 flex items-center gap-1 px-2 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-out will-change-transform"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
        paddingBottom: "10px",
        boxShadow: "inset 0 -1px 0 hsl(var(--border) / 0.6)",
        transform: hidden ? "translateY(-110%)" : "translateY(0)",
      }}
    >
      <SidebarTrigger className="admin-icon-btn" aria-label="Abrir menu" />
      <h1 className="flex-1 min-w-0 truncate text-[15px] font-medium tracking-tight text-foreground">
        {title}
      </h1>
      {fab && FabIcon && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={fab.label}
          onClick={() => { haptic.tap(); fab.onClick(); }}
          className="admin-icon-btn h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90 active:scale-95 transition-transform"
        >
          <FabIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="admin-icon-btn"
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
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
