import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONTRACT_TEMPLATE, type ContractTemplate } from "@/utils/contractPdf";

export async function loadContractTemplate(): Promise<ContractTemplate> {
  try {
    const { data, error } = await supabase
      .from("contract_templates" as any)
      .select("company_name, company_address, company_ein, header_subtitle, clauses, disclaimer, footer_text")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_CONTRACT_TEMPLATE;
    const row = data as any;
    return {
      company_name: row.company_name ?? DEFAULT_CONTRACT_TEMPLATE.company_name,
      company_address: row.company_address ?? DEFAULT_CONTRACT_TEMPLATE.company_address,
      company_ein: row.company_ein ?? DEFAULT_CONTRACT_TEMPLATE.company_ein,
      header_subtitle: row.header_subtitle ?? DEFAULT_CONTRACT_TEMPLATE.header_subtitle,
      clauses: Array.isArray(row.clauses) ? (row.clauses as string[]) : DEFAULT_CONTRACT_TEMPLATE.clauses,
      disclaimer: row.disclaimer ?? DEFAULT_CONTRACT_TEMPLATE.disclaimer,
      footer_text: row.footer_text ?? DEFAULT_CONTRACT_TEMPLATE.footer_text,
    };
  } catch {
    return DEFAULT_CONTRACT_TEMPLATE;
  }
}
