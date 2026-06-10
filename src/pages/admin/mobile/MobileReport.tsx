import { lazy, Suspense, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";

const AdminFleetReport = lazy(() => import("../AdminFleetReport"));
const AdminFleetPnL = lazy(() => import("../AdminFleetPnL"));

/* ============================================================
   RELATÓRIO — Mobile-first
   Tabs em segmented para evitar scroll vertical longo.
   ============================================================ */

export default function MobileReport() {
  const [tab, setTab] = useState<"perf" | "pnl">("perf");

  return (
    <div className="pb-24">
      <div className="px-4 pt-2">
        <h1 className="admin-h1 text-2xl">Relatório</h1>
        <p className="text-xs text-muted-foreground mt-1">Desempenho e rentabilidade</p>
        <div className="mt-3">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as any)}
            options={[
              { value: "perf", label: "Desempenho", icon: <BarChart3 size={13} /> },
              { value: "pnl", label: "Rentabilidade", icon: <TrendingUp size={13} /> },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 px-2">
        <Suspense fallback={<FleetReportSkeleton />}>
          {tab === "perf" ? <AdminFleetReport embedded /> : <AdminFleetPnL embedded />}
        </Suspense>
      </div>
    </div>
  );
}
