import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { OverviewTab } from "@/components/admin/finance/OverviewTab";
import { TransactionsTab } from "@/components/admin/finance/TransactionsTab";
import { CategoriesTab } from "@/components/admin/finance/CategoriesTab";
import { AccountsTab } from "@/components/admin/finance/AccountsTab";

/* ============================================================
   FINANCEIRO. Mobile-first
   Header compacto + segmented horizontal scrollable.
   Pull-to-refresh invalida todas as queries ativas da rota.
   ============================================================ */

const TABS = [
  { value: "overview", label: "Visão" },
  { value: "transactions", label: "Lançam." },
  { value: "categories", label: "Categ." },
  { value: "accounts", label: "Contas" },
];

export default function MobileFinance() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const active = params.get("tab") || "overview";
  const setActive = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "overview") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };

  const handleRefresh = async () => {
    await qc.invalidateQueries({ type: "active" });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="pb-24">
        <div className="px-4 pt-1">
          <p className="text-xs text-muted-foreground">Visão geral da operação</p>


          <div className="mt-3">
            <SegmentedControl value={active} onChange={setActive} options={TABS} />
          </div>
        </div>

        <div className="mt-4 px-2">
          {active === "overview" && <OverviewTab />}
          {active === "transactions" && <TransactionsTab />}
          {active === "categories" && <CategoriesTab />}
          {active === "accounts" && <AccountsTab />}
        </div>
      </div>
    </PullToRefresh>
  );
}
