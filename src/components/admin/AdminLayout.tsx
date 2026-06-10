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
        // Match the reference mockup: wider sidebar on desktop AND mobile sheet.
        ["--sidebar-width" as any]: "17rem",
        ["--sidebar-width-mobile" as any]: "17rem",
      } as React.CSSProperties}
    >
      <AdminTabsProvider>
        <div className="admin-shell min-h-[100dvh] flex w-full bg-background">
          <AdminSidebar onSignOut={signOut} />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Barra de abas no topo absoluto (estilo navegador) */}
            <AdminTabsBar />
            <header
              className="h-14 flex items-center gap-2 sm:gap-3 border-b border-border/40 px-3 sm:px-4 bg-background/90 backdrop-blur-md sticky top-0 z-30"
            >
              <SidebarTrigger className="h-11 w-11 -ml-2 flex items-center justify-center text-muted-foreground hover:text-foreground" />
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
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
            </header>
            <main
              className="flex-1 p-3 sm:p-4 md:p-6"
              style={{
                paddingBottom:
                  "max(env(safe-area-inset-bottom, 0px), clamp(1.5rem, 3vh, 3rem))",
              }}
            >
              <Outlet />
            </main>

            <MinimalFooter />
          </div>
        </div>
      </AdminTabsProvider>

    </SidebarProvider>
  );
}

