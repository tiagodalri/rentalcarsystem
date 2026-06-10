import { useSearchParams } from "react-router-dom";
import { DollarSign } from "lucide-react";
import { SegmentedControl } from "@/components/mobile/SegmentedControl";
import { OverviewTab } from "@/components/admin/finance/OverviewTab";
import { TransactionsTab } from "@/components/admin/finance/TransactionsTab";
import { CategoriesTab } from "@/components/admin/finance/CategoriesTab";
import { AccountsTab } from "@/components/admin/finance/AccountsTab";

/* ============================================================
   FINANCEIRO — Mobile-first
   Header compacto + segmented horizontal scrollable.
   ============================================================ */

const TABS = [
  { value: "overview", label: "Visão" },
  { value: "transactions", label: "Lançam." },
  { value: "categories", label: "Categ." },
  { value: "accounts", label: "Contas" },
];

export default function MobileFinance() {
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "overview";
  const setActive = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "overview") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="pb-24">
      <div className="px-4 pt-2">
        <h1 className="admin-h1 text-2xl flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" /> Financeiro
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Visão geral da operação</p>

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
  );
}
