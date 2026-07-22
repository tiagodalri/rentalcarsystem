import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from "lucide-react";
import { OverviewTab } from "@/components/admin/finance/OverviewTab";
import { TransactionsTab } from "@/components/admin/finance/TransactionsTab";
import { CategoriesTab } from "@/components/admin/finance/CategoriesTab";
import { AccountsTab } from "@/components/admin/finance/AccountsTab";
import { PartnerPayoutsTab } from "@/components/admin/finance/PartnerPayoutsTab";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import MobileFinance from "./mobile/MobileFinance";

export default function AdminFinance() {
  const { isMobile } = useIsMobileApp();
  const [params, setParams] = useSearchParams();
  if (isMobile) return <MobileFinance />;
  const activeTab = params.get("tab") || "overview";
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "overview") next.delete("tab");
    else next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="admin-h1 text-2xl flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" /> Financeiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da operação</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="partner-payouts">Repasses a parceiros</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="partner-payouts"><PartnerPayoutsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

