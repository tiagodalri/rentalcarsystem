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
  Upload,
  GraduationCap,
  ScrollText,
  Receipt,
  Wallet,
  Brain,
  Handshake,
  MessageSquare,
} from "lucide-react";
import { motion } from "framer-motion";

import BrandLogo from "@/components/BrandLogo";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminTabs } from "@/hooks/useAdminTabs";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  highlight?: "gold" | "emerald";
  badge?: string;
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
      { title: "Sincronizar Turo", url: "/admin/turo-import", icon: Upload, allowedRoles: ["admin","operations"] },
      { title: "Sincronizar E-Pass", url: "/admin/epass-import", icon: Upload, allowedRoles: ["admin","operations","finance"] },
      { title: "Pedágios", url: "/admin/tolls", icon: Receipt, allowedRoles: ["admin","operations","finance"] },
      
      
      { title: "Agenda", url: "/admin/calendar",  icon: CalendarDays,  allowedRoles: ["admin","operations","support"] },
      { title: "Frota",      url: "/admin/fleet",     icon: Car,           allowedRoles: ["admin","operations"] },
      { title: "Clientes",   url: "/admin/customers", icon: Users,         allowedRoles: ["admin","operations","support"] },
      { title: "WhatsApp",   url: "/admin/whatsapp",  icon: MessageSquare, allowedRoles: ["admin","operations","support"] },

    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/admin/finance", icon: DollarSign, allowedRoles: ["admin","finance"] },
      { title: "Central de Custos", url: "/admin/costs", icon: Wallet, allowedRoles: ["admin","operations","finance","driver"] },
      { title: "Relatórios", url: "/admin/report",  icon: BarChart3,  allowedRoles: ["admin","finance"] },
    ],
  },
  {
    label: "Frota Inteligente",
    items: [
      { title: "Frota Inteligente", url: "/admin/frota-inteligente", icon: Brain, allowedRoles: ["admin","operations","finance","support"], highlight: "gold", badge: "IA" },
    ],
  },
  {
    label: "GoDalz Rent",
    items: [
      { title: "GoDalz Rent", url: "/admin/godalz-rent", icon: Handshake, allowedRoles: ["admin","operations","finance","support"], highlight: "emerald", badge: "Novo" },
    ],
  },
  {
    label: "Aprenda",
    items: [
      { title: "Tutoriais", url: "/admin/tutoriais", icon: GraduationCap, allowedRoles: ["admin","operations","support","driver","finance"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Configurações", url: "/admin/settings", icon: Settings,   allowedRoles: ["admin"] },
    ],
  },
];

interface AdminSidebarProps {
  onSignOut: () => void;
}

/** Compact stats card that mirrors the bottom-of-sidebar "FROTA" widget in the mockup. */
function FleetMiniStats() {
  const [vehicles, setVehicles] = useState<Array<{ status: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("list_vehicles_basic");
      if (cancelled) return;
      setVehicles((data || []) as Array<{ status: string | null }>);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  // Painel de Logs é visível somente para o super-admin.
  const visibleSections = menuSections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (!hasAny(it.allowedRoles)) return false;
        if (it.url === "/admin/logs" && email.toLowerCase() !== "admin@rentalcarsystem.lovable.app") return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent
        className={`pb-2 gap-0 scrollbar-thin ${collapsed ? "px-0 mx-0" : "px-[8px] mx-[8px]"}`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        {/* ===== Brand block ===== */}
        <div className={`flex flex-col items-center ${collapsed ? "px-0 py-2" : "px-2 pb-3"}`}>
          {collapsed ? (
            <BrandLogo size="sm" dark showMark={false} className="opacity-95" />
          ) : (
            <BrandLogo size="md" dark showMark={false} className="opacity-95" />
          )}
        </div>

        {/* ===== Sections ===== */}
        {visibleSections.map((section) => (
          <div key={section.label}>
            {!collapsed && <SectionLabel>{section.label.toUpperCase()}</SectionLabel>}
            <SidebarMenu className={`gap-0.5 ${collapsed ? "items-center" : ""}`}>
              {section.items.map((item) => {
                const active = isActive(item.url);
                const isGold = item.highlight === "gold";
                const isEmerald = item.highlight === "emerald";
                const isHighlight = isGold || isEmerald;
                const emeraldColor = "#0F9E7A";
                const emeraldStyle: React.CSSProperties | undefined = isEmerald
                  ? { color: emeraldColor }
                  : undefined;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={(e) => handleNavigate(item.url, e)}
                      onAuxClick={(e) => handleAuxClick(item.url, e)}
                      isActive={active}
                      tooltip={item.title}
                      style={
                        isEmerald && !active
                          ? { color: emeraldColor }
                          : active && isEmerald
                            ? { color: emeraldColor, background: "rgba(15,158,122,0.12)" }
                            : undefined
                      }
                      className={`relative h-8 rounded-lg transition-all duration-150 ${
                        collapsed ? "mx-auto justify-center px-0 [&>svg]:mx-auto" : "px-3"
                      } ${
                        active && !isEmerald
                          ? "bg-sidebar-primary/12 text-sidebar-primary font-semibold hover:bg-sidebar-primary/15 hover:text-sidebar-primary"
                          : isGold
                            ? "text-sidebar-primary/90 hover:text-sidebar-primary hover:bg-sidebar-primary/10"
                            : isEmerald
                              ? "hover:bg-[rgba(15,158,122,0.12)]"
                              : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      {active && !collapsed && !isEmerald && (
                        <motion.span
                          layoutId={`sb-active-${section.label}`}
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sidebar-primary"
                        />
                      )}
                      {isEmerald && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full"
                          style={{ background: emeraldColor, opacity: active ? 1 : 0.8 }}
                        />
                      )}
                      {isGold && !active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-sidebar-primary opacity-80" />
                      )}
                      <item.icon
                        className={`h-[16px] w-[16px] shrink-0 ${
                          (active || isGold) && !isEmerald ? "text-sidebar-primary" : ""
                        }`}
                        style={emeraldStyle}
                        strokeWidth={active || isHighlight ? 2.2 : 1.8}
                      />
                      {!collapsed && (
                        <span className={`text-[12.5px] leading-none flex-1 ${isHighlight ? "font-semibold" : ""}`}>
                          {item.title}
                        </span>
                      )}
                      {!collapsed && item.badge && (
                        <span
                          className="ml-auto inline-flex items-center px-1.5 h-4 rounded-full text-[8.5px] font-semibold tracking-[0.14em] uppercase"
                          style={
                            isEmerald
                              ? {
                                  background: "linear-gradient(180deg, #12b48a, #0d8a68)",
                                  color: "#ffffff",
                                  border: "1px solid rgba(15,158,122,0.55)",
                                }
                              : {
                                  background: "linear-gradient(180deg, hsl(45 82% 60%), hsl(42 78% 50%))",
                                  color: "#0F0F0F",
                                  border: "1px solid rgba(232,185,53,0.55)",
                                }
                          }
                        >
                          {item.badge}
                        </span>
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
