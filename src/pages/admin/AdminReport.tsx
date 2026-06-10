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
    <div className="space-y-10">
      <header className="hidden lg:block">
        <h1 className="admin-h1">Relatório consolidado</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão estratégica única — desempenho operacional mensal e rentabilidade
          completa da frota lado a lado.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <BarChart3 size={14} className="text-muted-foreground" />
          <h2 className="admin-section-title">Desempenho mensal</h2>
        </div>
        <Suspense fallback={<FleetReportSkeleton />}>
          <AdminFleetReport embedded />
        </Suspense>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
          <TrendingUp size={14} className="text-muted-foreground" />
          <h2 className="admin-section-title">Rentabilidade da frota</h2>
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
