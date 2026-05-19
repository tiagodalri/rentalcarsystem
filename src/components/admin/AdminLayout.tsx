import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MinimalFooter from "@/components/MinimalFooter";
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar onSignOut={signOut} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 sm:gap-4 border-b border-border/40 px-3 sm:px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex-1" />
            <LanguageSwitcher />
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </span>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            <Outlet />
          </main>
          <MinimalFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}
