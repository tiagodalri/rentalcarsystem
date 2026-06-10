import { lazy, Suspense, useMemo } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp } from "lucide-react";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";

const AdminFleetReport = lazy(() => import("./AdminFleetReport"));
const AdminFleetPnL = lazy(() => import("./AdminFleetPnL"));

type Tab = "mensal" | "rentabilidade";
const VALID: Tab[] = ["mensal", "rentabilidade"];

/**
 * Wrapper unificado: substitui as antigas entradas separadas "Relatório" e
 * "Lucro Frota" no menu. Mantém os dois relatórios como abas internas
 * compartilhando a mesma rota /admin/report?tab=...
 */
export default function AdminReport() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = (params.get("tab") || "mensal") as Tab;
  const tab: Tab = VALID.includes(raw) ? raw : "mensal";

  const onTabChange = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Desempenho mensal e rentabilidade consolidada da frota
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mensal" className="flex items-center gap-2">
            <BarChart3 size={14} /> Desempenho mensal
          </TabsTrigger>
          <TabsTrigger value="rentabilidade" className="flex items-center gap-2">
            <TrendingUp size={14} /> Rentabilidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="mt-4">
          <Suspense fallback={<FleetReportSkeleton />}>
            <AdminFleetReport embedded />
          </Suspense>
        </TabsContent>
        <TabsContent value="rentabilidade" className="mt-4">
          <Suspense fallback={<FleetReportSkeleton />}>
            <AdminFleetPnL embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Redirect legado: /admin/report/fleet-pnl → /admin/report?tab=rentabilidade */
export function AdminFleetPnLRedirect() {
  return <Navigate to="/admin/report?tab=rentabilidade" replace />;
}
