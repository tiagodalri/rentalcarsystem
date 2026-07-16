import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { BarChart3, TrendingUp } from "lucide-react";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import MobileReport from "./mobile/MobileReport";

const AdminFleetReport = lazy(() => import("./AdminFleetReport"));
const AdminFleetPnL = lazy(() => import("./AdminFleetPnL"));

/**
 * Relatório único e consolidado: Desempenho mensal + Rentabilidade
 * em uma única página estratégica, sem abas.
 */
export default function AdminReport() {
  const { isMobile } = useIsMobileApp();
  if (isMobile) return <MobileReport />;
  return (
    <div className="space-y-8">
      <header className="hidden lg:block pb-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-primary/60" />
          <div>
            <h1 className="admin-h1 text-[22px]">Relatório Consolidado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão estratégica única. desempenho operacional mensal e rentabilidade
              completa da frota lado a lado.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
            <BarChart3 size={14} className="text-primary" />
          </div>
          <h2 className="admin-section-title text-[12px] tracking-[0.18em]">Desempenho Mensal</h2>
        </div>
        <Suspense fallback={<FleetReportSkeleton />}>
          <AdminFleetReport embedded />
        </Suspense>
      </section>

      <div className="section-separator my-2" />

      <section className="space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <div className="h-7 w-7 rounded-md bg-emerald-700/10 flex items-center justify-center">
            <TrendingUp size={14} className="text-emerald-700" />
          </div>
          <h2 className="admin-section-title text-[12px] tracking-[0.18em]">Rentabilidade da Frota</h2>
        </div>
        <Suspense fallback={<FleetReportSkeleton />}>
          <AdminFleetPnL embedded />
        </Suspense>
      </section>
    </div>
  );
}

/** Redirect legado: /admin/report/fleet-pnl → /admin/report */
export function AdminFleetPnLRedirect() {
  return <Navigate to="/admin/report" replace />;
}
