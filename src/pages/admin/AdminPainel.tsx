import { lazy, Suspense, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, BarChart3, TrendingUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format, startOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminDashboard from "./AdminDashboard";

const AdminFleetReport = lazy(() => import("./AdminFleetReport"));
const AdminFleetPnL = lazy(() => import("./AdminFleetPnL"));

type Tab = "visao-geral" | "desempenho" | "rentabilidade";
const VALID: Tab[] = ["visao-geral", "desempenho", "rentabilidade"];

/**
 * Painel unificado: substitui Dashboard + Relatórios.
 * - Visão Geral: KPIs operacionais, frota, financeiro (filtrados por período)
 * - Desempenho: análise mensal por veículo (filtrado por período)
 * - Rentabilidade: P&L all-time da frota
 *
 * Filtro de período (mês selecionado) afeta Visão Geral + Desempenho.
 * Rentabilidade permanece all-time (faz mais sentido para ROI / Payback).
 */
export default function AdminPainel() {
  const [params, setParams] = useSearchParams();
  const { hasAny } = useAdminAuth();

  const canSeeAnalytics = hasAny(["admin", "finance"]);

  const raw = (params.get("tab") || "visao-geral") as Tab;
  const tab: Tab = VALID.includes(raw) ? raw : "visao-geral";
  // Guard: ops/support sem acesso a abas analíticas caem em Visão Geral
  const effectiveTab: Tab =
    !canSeeAnalytics && tab !== "visao-geral" ? "visao-geral" : tab;

  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const isCurrent = isSameMonth(month, new Date());
  const isPrev = isSameMonth(month, subMonths(new Date(), 1));

  const onTabChange = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  const periodLabel = useMemo(
    () => format(month, "MMMM yyyy", { locale: ptBR }),
    [month],
  );

  return (
    <div className="space-y-5">
      {/* Header + Period filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="admin-h1">Painel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral, desempenho e rentabilidade consolidada
          </p>
        </div>

        {effectiveTab !== "rentabilidade" && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMonth(startOfMonth(new Date()))}
              >
                Este mês
              </Button>
              <Button
                variant={isPrev ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMonth(startOfMonth(subMonths(new Date(), 1)))}
              >
                Mês passado
              </Button>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMonth(subMonths(month, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-xs font-medium text-foreground px-2 min-w-[110px] text-center capitalize tabular-nums">
                {periodLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMonth(addMonths(month, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Tabs value={effectiveTab} onValueChange={onTabChange} className="w-full">
        <TabsList
          className={`grid w-full max-w-2xl ${
            canSeeAnalytics ? "grid-cols-3" : "grid-cols-1"
          }`}
        >
          <TabsTrigger value="visao-geral" className="flex items-center gap-2">
            <LayoutDashboard size={14} /> Visão Geral
          </TabsTrigger>
          {canSeeAnalytics && (
            <>
              <TabsTrigger value="desempenho" className="flex items-center gap-2">
                <BarChart3 size={14} /> Desempenho
              </TabsTrigger>
              <TabsTrigger value="rentabilidade" className="flex items-center gap-2">
                <TrendingUp size={14} /> Rentabilidade
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="visao-geral" className="mt-5">
          <AdminDashboard embedded periodMonth={month} />
        </TabsContent>

        {canSeeAnalytics && (
          <>
            <TabsContent value="desempenho" className="mt-5">
              <Suspense fallback={<FleetReportSkeleton />}>
                <AdminFleetReport embedded monthOverride={month} />
              </Suspense>
            </TabsContent>
            <TabsContent value="rentabilidade" className="mt-5">
              <Suspense fallback={<FleetReportSkeleton />}>
                <AdminFleetPnL embedded />
              </Suspense>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

/** Redirects legados de /admin/report* → /admin?tab=... */
export function AdminReportRedirect() {
  return <Navigate to="/admin?tab=desempenho" replace />;
}
export function AdminFleetPnLLegacyRedirect() {
  return <Navigate to="/admin?tab=rentabilidade" replace />;
}
