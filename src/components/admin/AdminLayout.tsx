import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTabsBar } from "./AdminTabsBar";
import { AdminTabsProvider } from "@/hooks/useAdminTabs";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MinimalFooter from "@/components/MinimalFooter";
import FullscreenFab from "./FullscreenFab";
import { AdminBottomNav } from "./AdminBottomNav";
import { AdminFab } from "./AdminFab";
import { AdminMobileHeader } from "./AdminMobileHeader";
import { PainelHeaderWidgets } from "./PainelHeaderWidgets";
import { AdminFabProvider } from "@/hooks/useAdminFab";

import { AdminShellSkeleton } from "@/components/skeletons/AdminShellSkeleton";
import { useThemeMode } from "@/i18n/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const { user, roles, loading, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const restrictedToastShown = useRef(false);
  const { theme, toggleTheme } = useThemeMode();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (roles.length === 0) {
      if (!restrictedToastShown.current) {
        restrictedToastShown.current = true;
        toast.error("Esta área é restrita à equipe Zeus Rental Car. Faça login com sua conta de equipe.");
      }
      navigate("/", { replace: true });
    }
  }, [loading, user, roles, navigate]);

  if (loading) {
    return <AdminShellSkeleton />;
  }

  if (!user || roles.length === 0) return null;

  return (
    <SidebarProvider
      style={{
        ["--sidebar-width" as any]: "15.5rem",
        ["--sidebar-width-mobile" as any]: "15.5rem",
      } as React.CSSProperties}
    >
      <AdminTabsProvider>
        <AdminFabProvider>
          <div className="admin-shell min-h-[100dvh] flex w-full bg-background">
            <AdminSidebar onSignOut={signOut} />
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mobile: header compacto contextual */}
              <AdminMobileHeader />

              {/* Desktop: abas tipo navegador + ticker CNN-style + barra de utilitários */}
              <AdminTabsBar />
              <header className="hidden lg:flex items-stretch border-b border-border/40 bg-background/90 backdrop-blur-md sticky top-0 z-30">
                <SidebarTrigger className="h-9 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground border-r border-border/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <PainelHeaderWidgets />
                </div>
              </header>
              {/* Utilitários (tema, idioma, fullscreen) — abaixo da divisão */}
              <div className="hidden lg:flex h-10 items-center justify-end gap-1.5 px-3 sm:px-4">
                <FullscreenFab />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                  title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <LanguageSwitcher className="h-9 w-9 justify-center rounded-full hover:bg-accent/60" />
              </div>

              <main
                className="flex-1 px-4 pt-3 pb-4 lg:p-6"
                style={{
                  // Reserva espaço pra bottom nav em mobile; desktop usa o padding normal.
                  paddingBottom:
                    "max(calc(64px + env(safe-area-inset-bottom, 0px) + 16px), 1rem)",
                }}
              >
                <Outlet />
              </main>

              <div className="hidden lg:block">
                <MinimalFooter />
              </div>
            </div>

            {/* Mobile-only chrome */}
            <AdminFab />
            <AdminBottomNav />
          </div>
        </AdminFabProvider>
      </AdminTabsProvider>
    </SidebarProvider>
  );
}
