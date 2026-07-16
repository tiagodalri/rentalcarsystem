import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, Loader2, Plus, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DEFAULT_CONTRACT_TEMPLATE, generateContractPdf, type ContractTemplate } from "@/utils/contractPdf";

const AdminContractTemplate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [tpl, setTpl] = useState<ContractTemplate>(DEFAULT_CONTRACT_TEMPLATE);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contract_templates" as any)
        .select("id, company_name, company_address, company_ein, header_subtitle, clauses, disclaimer, footer_text")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const row = data as any;
        setRowId(row.id);
        setTpl({
          company_name: row.company_name ?? "",
          company_address: row.company_address ?? "",
          company_ein: row.company_ein ?? "",
          header_subtitle: row.header_subtitle ?? "",
          clauses: Array.isArray(row.clauses) ? row.clauses : [],
          disclaimer: row.disclaimer ?? "",
          footer_text: row.footer_text ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const updateClause = (i: number, value: string) => {
    setTpl((p) => ({ ...p, clauses: p.clauses.map((c, idx) => (idx === i ? value : c)) }));
  };
  const addClause = () => setTpl((p) => ({ ...p, clauses: [...p.clauses, ""] }));
  const removeClause = (i: number) => setTpl((p) => ({ ...p, clauses: p.clauses.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        company_name: tpl.company_name.trim() || DEFAULT_CONTRACT_TEMPLATE.company_name,
        company_address: tpl.company_address.trim(),
        company_ein: tpl.company_ein.trim() || "",
        header_subtitle: tpl.header_subtitle.trim() || DEFAULT_CONTRACT_TEMPLATE.header_subtitle,
        clauses: tpl.clauses.map((c) => c.trim()).filter(Boolean),
        disclaimer: tpl.disclaimer.trim(),
        footer_text: tpl.footer_text.trim() || DEFAULT_CONTRACT_TEMPLATE.footer_text,
      };
      const q = rowId
        ? supabase.from("contract_templates" as any).update(payload).eq("id", rowId)
        : supabase.from("contract_templates" as any).insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success("Modelo de contrato salvo.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    const today = new Date().toISOString().slice(0, 10);
    const inTen = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    generateContractPdf(
      {
        id: "preview",
        booking_number: "ZRC-PREVIEW",
        status: "confirmed",
        pickup_date: today,
        return_date: inTen,
        pickup_time: "10:00",
        return_time: "10:00",
        pickup_location: "Orlando International Airport (MCO)",
        return_location: "Orlando International Airport (MCO)",
        total_price: 990,
        addons: { GPS: true, "Cadeira infantil": 1 },
        extra_driver: true,
        deposit_amount: 500,
        franchise_amount: 1500,
      },
      {
        full_name: "Cliente de Exemplo",
        email: "cliente@exemplo.com",
        phone: "+55 11 99999-9999",
        document_number: "000.000.000-00",
        driver_license: "12345678",
        driver_license_expiry: "2030-12-31",
        nationality: "Brasileiro",
        address: "Rua Exemplo, 123",
        zip_code: "00000-000",
      },
      {
        name: "Volkswagen Tiguan",
        category: "SUV Premium",
        license_plate: "ABC-1234",
        year: 2024,
        color: "Preto",
        current_odometer: 12345,
        daily_price_usd: 99,
      },
      tpl,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/admin/contracts")}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border/50 hover:bg-accent"
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <AdminPageHeader
          title="Modelo de Contrato"
          subtitle="Visualize e edite o contrato de locação utilizado em todas as reservas."
        />
      </div>

      {loading ? (
        <div className="admin-card p-10 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin mr-2" /> Carregando modelo…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <section className="admin-card p-5 space-y-4">
              <div className="admin-section-title">Cabeçalho & Identificação</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Razão social / Locadora">
                  <Input value={tpl.company_name} onChange={(e) => setTpl({ ...tpl, company_name: e.target.value })} />
                </Field>
                <Field label="EIN / CNPJ">
                  <Input value={tpl.company_ein} onChange={(e) => setTpl({ ...tpl, company_ein: e.target.value })} />
                </Field>
                <Field label="Endereço da locadora" className="md:col-span-2">
                  <Input value={tpl.company_address} onChange={(e) => setTpl({ ...tpl, company_address: e.target.value })} />
                </Field>
                <Field label="Subtítulo do cabeçalho" className="md:col-span-2">
                  <Input value={tpl.header_subtitle} onChange={(e) => setTpl({ ...tpl, header_subtitle: e.target.value })} />
                </Field>
              </div>
            </section>

            <section className="admin-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="admin-section-title">Cláusulas Gerais</div>
                <Button type="button" variant="outline" size="sm" onClick={addClause}>
                  <Plus size={14} className="mr-1" /> Adicionar cláusula
                </Button>
              </div>
              <div className="space-y-3">
                {tpl.clauses.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma cláusula. Adicione ao menos uma.</p>
                )}
                {tpl.clauses.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[11px] text-muted-foreground mt-3 w-6 tabular-nums">{i + 1}.</span>
                    <Textarea
                      value={c}
                      onChange={(e) => updateClause(i, e.target.value)}
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <button
                      onClick={() => removeClause(i)}
                      className="mt-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Remover cláusula"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-card p-5 space-y-4">
              <div className="admin-section-title">Disclaimer & Rodapé</div>
              <Field label="Disclaimer (exibido após as cláusulas)">
                <Textarea value={tpl.disclaimer} onChange={(e) => setTpl({ ...tpl, disclaimer: e.target.value })} rows={3} />
              </Field>
              <Field label="Texto do rodapé">
                <Input value={tpl.footer_text} onChange={(e) => setTpl({ ...tpl, footer_text: e.target.value })} />
              </Field>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 self-start">
            <div className="admin-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText size={14} className="text-primary" /> Ações
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                Salvar alterações
              </Button>
              <Button onClick={preview} variant="outline" className="w-full">
                <Eye size={14} className="mr-2" /> Visualizar PDF de exemplo
              </Button>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A pré-visualização usa dados fictícios apenas para demonstrar o layout. As alterações só passam a valer nos
                contratos reais após clicar em <strong>Salvar</strong>.
              </p>
            </div>

            <div className="admin-card p-5 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>Os blocos abaixo são gerados automaticamente a partir de cada reserva e não são editáveis aqui:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Dados do locatário (cliente)</li>
                <li>Dados do veículo</li>
                <li>Datas, locais, valores e extras</li>
                <li>Linhas de assinatura</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">{label}</label>
    {children}
  </div>
);

export default AdminContractTemplate;
