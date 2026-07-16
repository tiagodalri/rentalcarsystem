import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTabsBar } from "./AdminTabsBar";
import { AdminTabsProvider } from "@/hooks/useAdminTabs";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MinimalFooter from "@/components/MinimalFooter";
import FullscreenFab from "./FullscreenFab";
import PresentationModeButton from "./PresentationModeButton";
import { AdminBottomNav } from "./AdminBottomNav";
import { AdminFab } from "./AdminFab";
import { AdminMobileHeader } from "./AdminMobileHeader";
import { PainelHeaderWidgets } from "./PainelHeaderWidgets";
import { AdminFabProvider } from "@/hooks/useAdminFab";
import { GuidedTourProvider } from "@/components/admin/guided-tour/GuidedTourContext";
import GuidedTour from "@/components/admin/guided-tour/GuidedTour";
import { usePrefetchAdminRoutes } from "@/hooks/usePrefetchAdminRoutes";
import { MobileFabDock } from "@/components/mobile/MobileFabDock";
import { ConfirmProvider } from "@/components/mobile/ConfirmSheet";

import { AdminShellSkeleton } from "@/components/skeletons/AdminShellSkeleton";
import { useThemeMode } from "@/i18n/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/admin/motion/PageTransition";

export default function AdminLayout() {
  const { user, roles, loading, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const restrictedToastShown = useRef(false);
  const { theme, toggleTheme } = useThemeMode();

  // Wave 2: depois que o admin está autenticado, baixa os chunks pesados
  // em idle. Próxima navegação fica instantânea.
  usePrefetchAdminRoutes(Boolean(user) && !loading);



  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (roles.length === 0) {
      if (!restrictedToastShown.current) {
        restrictedToastShown.current = true;
        toast.error("Esta área é restrita à equipe GoDrive. Faça login com sua conta de equipe.");
      }
      navigate("/", { replace: true });
    }
  }, [loading, user, roles, navigate]);

  // Driver-only users land on Operação (Hoje), not the financial Painel.
  useEffect(() => {
    if (loading) return;
    if (!user || roles.length === 0) return;
    const isDriverOnly = roles.length > 0 && roles.every((r) => r === "driver");
    if (isDriverOnly && location.pathname === "/admin") {
      navigate("/admin/ops-today", { replace: true });
    }
  }, [loading, user, roles, location.pathname, navigate]);

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
          <ConfirmProvider>
          <GuidedTourProvider>
          <div className="admin-shell min-h-[100dvh] flex w-full bg-background">
            <AdminSidebar onSignOut={signOut} />
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mobile: header compacto contextual */}
              <AdminMobileHeader />

              {/* Desktop: abas tipo navegador + ticker CNN-style + barra de utilitários */}
              <AdminTabsBar />
              <header className="hidden lg:flex items-stretch border-b border-border/40 bg-background/90 backdrop-blur-md sticky top-0 z-30">
                <div className="flex-1 min-w-0">
                  <PainelHeaderWidgets />
                </div>
              </header>
              {/* Utilitários (tema, idioma, fullscreen) — abaixo da divisão */}
              <div className="hidden lg:flex h-10 items-center justify-end gap-1.5 px-3 sm:px-4">
                <PresentationModeButton variant="icon" />
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

              <main className="flex-1 px-4 pt-4 pb-[max(calc(64px+env(safe-area-inset-bottom,0px)+20px),1rem)] lg:px-8 lg:pt-8 lg:pb-10">
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </main>

              <div className="hidden lg:block">
                <MinimalFooter />
              </div>
            </div>

            {/* Mobile-only chrome */}
            <AdminFab />
            <MobileFabDock />
            <AdminBottomNav />
            <GuidedTour />
          </div>
          </GuidedTourProvider>
          </ConfirmProvider>
        </AdminFabProvider>
      </AdminTabsProvider>
    </SidebarProvider>
  );
}
