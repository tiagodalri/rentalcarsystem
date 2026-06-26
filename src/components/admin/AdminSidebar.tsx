import {
  LayoutDashboard,
  Car,
  CalendarRange,
  Users,
  LogOut,
  Settings,
  Radio,
  BarChart3,
  DollarSign,
  UsersRound,
  Sparkles,
  CalendarDays,
  ChevronDown,
  FileSignature,
  Upload,
  GraduationCap,
} from "lucide-react";

import zeusLogo from "@/assets/zeus-logo-mark.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminTabs } from "@/hooks/useAdminTabs";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { useVehiclesDB } from "@/hooks/useVehiclesDB";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  allowedRoles: AppRole[];
};

type MenuSection = {
  label: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    label: "Operações",
    items: [
      { title: "Painel",        url: "/admin",           icon: LayoutDashboard, allowedRoles: ["admin","finance","operations","support"] },
      { title: "Operação", url: "/admin/ops-today", icon: Sparkles,        allowedRoles: ["admin","operations","support","driver"] },
      { title: "Live",          url: "/admin/live",      icon: Radio,           allowedRoles: ["admin","operations"] },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Reservas",   url: "/admin/bookings",  icon: CalendarRange, allowedRoles: ["admin","operations","support","driver"] },
      { title: "Importar Turo", url: "/admin/turo-import", icon: Upload, allowedRoles: ["admin","operations"] },
      { title: "Contratos",  url: "/admin/contracts", icon: FileSignature, allowedRoles: ["admin","operations","support","finance"] },
      { title: "Agenda", url: "/admin/calendar",  icon: CalendarDays,  allowedRoles: ["admin","operations","support"] },
      { title: "Frota",      url: "/admin/fleet",     icon: Car,           allowedRoles: ["admin","operations"] },
      { title: "Clientes",   url: "/admin/customers", icon: Users,         allowedRoles: ["admin","operations","support"] },

    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/admin/finance", icon: DollarSign, allowedRoles: ["admin","finance"] },
      { title: "Relatórios", url: "/admin/report",  icon: BarChart3,  allowedRoles: ["admin","finance"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Equipe",        url: "/admin/team",     icon: UsersRound, allowedRoles: ["admin"] },
      { title: "Configurações", url: "/admin/settings", icon: Settings,   allowedRoles: ["admin"] },
    ],
  },
];

interface AdminSidebarProps {
  onSignOut: () => void;
}

/** Compact stats card that mirrors the bottom-of-sidebar "FROTA" widget in the mockup. */
function FleetMiniStats() {
  const { vehicles, loading } = useVehiclesDB();

  if (loading) {
    return (
      <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-3 animate-pulse">
        <div className="h-3 w-12 bg-sidebar-border/60 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-6 w-10 bg-sidebar-border/60 rounded" />
          <div className="h-6 w-10 bg-sidebar-border/60 rounded" />
          <div className="h-6 w-10 bg-sidebar-border/60 rounded" />
        </div>
      </div>
    );
  }

  const total = vehicles.length;
  const available = vehicles.filter((v) => v.status === "available").length;
  const preparing = vehicles.filter((v) =>
    ["maintenance", "preparing", "cleaning", "in_preparation"].includes((v.status || "").toLowerCase()),
  ).length;

  const Row = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-baseline gap-2">
      <div className="text-[15px] font-medium tabular-nums leading-none text-sidebar-primary w-6">
        {value}
      </div>
      <div className="text-[10px] text-sidebar-foreground/55 leading-none">{label}</div>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-lg border border-sidebar-border/60 bg-gradient-to-br from-sidebar-accent/60 to-sidebar-accent/20 px-3 py-2.5">
      <div className="text-[9px] font-semibold tracking-[0.18em] text-sidebar-primary mb-2">
        FROTA
      </div>
      <div className="space-y-1.5">
        <Row value={total} label="Veículos totais" />
        <Row value={available} label="Disponíveis" />
        <Row value={preparing} label="Em preparação" />
      </div>
    </div>
  );
}

/** Renders the gold uppercase section header with the trailing hairline rule. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 mb-1.5 mt-3 flex items-center gap-3">
      <span className="text-[9px] font-semibold tracking-[0.2em] text-sidebar-primary whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-sidebar-border/60" />
    </div>
  );
}

export function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { openTab } = useAdminTabs();
  const { user, hasAny } = useAdminAuth();

  const handleNavigate = (url: string, e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      openTab(url);
      return;
    }
    navigate(url);
    if (isMobile) setOpenMobile(false);
  };

  const handleAuxClick = (url: string, e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      openTab(url);
    }
  };

  const isActive = (url: string) =>
    url === "/admin" || url === "/admin/report"
      ? location.pathname === url
      : location.pathname.startsWith(url);

  const email = user?.email || "";
  // Best-effort display name: take part before '@' and titleize.
  const displayName = (() => {
    if (!email) return "Usuário";
    const handle = email.split("@")[0] || "";
    if (handle.toLowerCase() === "admin") return "Administrador";
    return handle
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || "Usuário";
  })();
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Filter sections by role; drop empty sections after filtering.
  const visibleSections = menuSections
    .map((s) => ({ ...s, items: s.items.filter((it) => hasAny(it.allowedRoles)) }))
    .filter((s) => s.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent
        className="pb-2 gap-0 scrollbar-thin px-[8px] mx-[8px]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        {/* ===== Brand block ===== */}
        <div className={`flex flex-col items-center ${collapsed ? "px-0 py-2" : "px-2 pb-3"}`}>
          <img
            src={zeusLogo}
            alt="Zeus Rental Car"
            className={`${
              collapsed ? "h-8 max-w-[32px]" : "h-11 max-w-[44px]"
            } w-auto object-contain opacity-95 transition-all`}
          />
          {!collapsed && (
            <div className="mt-2 text-[11.5px] font-semibold tracking-[0.32em] text-sidebar-foreground/85 text-center leading-none">
              ZEUS RENTAL CAR
            </div>
          )}
        </div>

        {/* ===== Sections ===== */}
        {visibleSections.map((section) => (
          <div key={section.label}>
            {!collapsed && <SectionLabel>{section.label.toUpperCase()}</SectionLabel>}
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={(e) => handleNavigate(item.url, e)}
                      onAuxClick={(e) => handleAuxClick(item.url, e)}
                      isActive={active}
                      tooltip={item.title}
                      className={`relative h-8 rounded-lg transition-all duration-150 ${
                        collapsed ? "mx-auto justify-center px-0 [&>svg]:mx-auto" : "px-3"
                      } ${
                        active
                          ? "bg-sidebar-primary/12 text-sidebar-primary font-semibold hover:bg-sidebar-primary/15 hover:text-sidebar-primary"
                          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon
                        className={`h-[16px] w-[16px] shrink-0 ${
                          active ? "text-sidebar-primary" : ""
                        }`}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      {!collapsed && (
                        <span className="text-[12.5px] leading-none">{item.title}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}

        {/* ===== Fleet stats widget (hidden when collapsed) ===== */}
        {!collapsed && (
          <div className="mt-3 px-1">
            <FleetMiniStats />
          </div>
        )}
      </SidebarContent>

      {/* ===== User footer card ===== */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-2 gap-2">
        {/* Collapse / expand sidebar */}
        <div className={collapsed ? "flex justify-center" : "flex justify-end px-1"}>
          <SidebarTrigger
            className="h-7 w-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          />
        </div>
        {collapsed ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onSignOut}
                tooltip="Sair"
                className="mx-auto justify-center px-0 [&>svg]:mx-auto text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors text-left"
              >
                <div className="h-8 w-8 shrink-0 rounded-full border border-sidebar-primary/60 bg-sidebar-accent/60 flex items-center justify-center text-[11px] font-medium text-sidebar-primary tabular-nums">
                  {initials || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-sidebar-foreground leading-tight truncate">
                    {displayName}
                  </div>
                  <div className="text-[10.5px] text-sidebar-foreground/55 leading-tight truncate">
                    {email}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-xs font-semibold">{displayName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
