import { MoreVertical, Sun, Moon } from "lucide-react";
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

export function AdminMobileHeader() {
  const title = useAdminPageTitle();
  const { theme, toggleTheme } = useThemeMode();

  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center gap-1 px-2 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-out will-change-transform"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2px)",
        paddingBottom: "6px",
        boxShadow: "inset 0 -1px 0 hsl(var(--border) / 0.6)",
        transform: "translateY(0)",
      }}
    >
      <SidebarTrigger className="admin-icon-btn" aria-label="Abrir menu" />
      <h1
        className="flex-1 min-w-0 truncate text-[18px] leading-none text-foreground tracking-[-0.02em]"
        style={{ fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif", fontWeight: 700 }}
      >
        {title}
      </h1>
      {/* Ação primária mora no MobileFabDock (zona do polegar). não duplicar aqui. */}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
