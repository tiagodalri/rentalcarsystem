import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { FleetReportSkeleton } from "@/components/skeletons/MinorPageSkeletons";

const AdminFleetReport = lazy(() => import("../AdminFleetReport"));
const AdminFleetPnL = lazy(() => import("../AdminFleetPnL"));

/* ============================================================
   RELATÓRIO. Mobile-first
   Tabs em segmented para evitar scroll vertical longo.
   ============================================================ */

export default function MobileReport() {
  const [tab, setTab] = useState<"perf" | "pnl">("perf");
  const qc = useQueryClient();
  const handleRefresh = async () => {
    await qc.invalidateQueries({ type: "active" });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="pb-24">
        <div className="px-4 pt-1">
          <p className="text-xs text-muted-foreground">Desempenho e rentabilidade</p>

          <div className="mt-3">
            <SegmentedControl
              value={tab}
              onChange={(v) => setTab(v as any)}
              options={[
                { value: "perf", label: "Desempenho" },
                { value: "pnl", label: "Rentabilidade" },
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
    </PullToRefresh>
  );
}
