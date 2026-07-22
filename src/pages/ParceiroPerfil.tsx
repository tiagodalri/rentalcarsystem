import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Building2, Eye, EyeOff, MapPin, Landmark, User2, ShieldCheck } from "lucide-react";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BR_UFS,
  formatBrPhone,
  formatCep,
  formatCnpj,
  formatCpfCnpj,
  isValidCnpj,
  isValidPixKey,
  onlyDigits,
  type PixKeyType,
} from "@/lib/brValidators";

type Form = {
  agency_name: string;
  legal_name: string;
  cnpj: string;
  state_registration: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_type: "" | "corrente" | "poupanca";
  bank_account_holder_name: string;
  bank_account_holder_document: string;
  pix_key_type: "" | PixKeyType;
  pix_key: string;
  notes: string;
};

const empty: Form = {
  agency_name: "", legal_name: "", cnpj: "", state_registration: "",
  contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
  address_zip: "", address_street: "", address_number: "", address_complement: "",
  address_neighborhood: "", address_city: "", address_state: "",
  bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "",
  bank_account_holder_name: "", bank_account_holder_document: "",
  pix_key_type: "", pix_key: "", notes: "",
};

const PIX_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export default function ParceiroPerfil() {
  const navigate = useNavigate();
  const [authorizing, setAuthorizing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("active");
  const [form, setForm] = useState<Form>(empty);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [showBankAccount, setShowBankAccount] = useState(false);
  const [showPixKey, setShowPixKey] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles").select("partner_id")
        .eq("user_id", session.user.id).eq("role", "partner").maybeSingle();
      if (!role?.partner_id) { navigate("/parceiro/login", { replace: true }); return; }
      setAuthorizing(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("partners")
        .select("*")
        .eq("id", role.partner_id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setForm({
          agency_name: data.agency_name ?? "",
          legal_name: data.legal_name ?? "",
          cnpj: data.cnpj ? formatCnpj(data.cnpj) : "",
          state_registration: data.state_registration ?? "",
          contact_name: data.contact_name ?? "",
          contact_role: data.contact_role ?? "",
          contact_email: data.contact_email ?? "",
          contact_phone: data.contact_phone ? formatBrPhone(data.contact_phone) : "",
          address_zip: data.address_zip ? formatCep(data.address_zip) : "",
          address_street: data.address_street ?? "",
          address_number: data.address_number ?? "",
          address_complement: data.address_complement ?? "",
          address_neighborhood: data.address_neighborhood ?? "",
          address_city: data.address_city ?? "",
          address_state: data.address_state ?? "",
          bank_name: data.bank_name ?? "",
          bank_agency: data.bank_agency ?? "",
          bank_account: data.bank_account ?? "",
          bank_account_type: (data.bank_account_type as Form["bank_account_type"]) ?? "",
          bank_account_holder_name: data.bank_account_holder_name ?? "",
          bank_account_holder_document: data.bank_account_holder_document
            ? formatCpfCnpj(data.bank_account_holder_document) : "",
          pix_key_type: (data.pix_key_type as Form["pix_key_type"]) ?? "",
          pix_key: data.pix_key ?? "",
          notes: data.notes ?? "",
        });
        setStatus(data.status ?? "active");
      }
      setLoading(false);
    })();
  }, [navigate]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onCnpjBlur = () => {
    if (!form.cnpj.trim()) { setCnpjError(null); return; }
    setCnpjError(isValidCnpj(form.cnpj) ? null : "CNPJ inválido");
  };

  const onPixBlur = () => {
    if (!form.pix_key_type || !form.pix_key.trim()) { setPixError(null); return; }
    setPixError(isValidPixKey(form.pix_key_type as PixKeyType, form.pix_key)
      ? null : "Chave PIX inválida para o tipo selecionado");
  };

  const onZipBlur = async () => {
    const d = onlyDigits(form.address_zip);
    if (d.length !== 8) return;
    setZipLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      if (!r.ok) return;
      const j = await r.json();
      if (j?.erro) return;
      setForm((f) => ({
        ...f,
        address_street: f.address_street || j.logradouro || "",
        address_neighborhood: f.address_neighborhood || j.bairro || "",
        address_city: f.address_city || j.localidade || "",
        address_state: f.address_state || (j.uf ? String(j.uf).toUpperCase() : ""),
      }));
    } catch { /* silent */ }
    finally { setZipLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agency_name.trim() || form.agency_name.trim().length < 2) {
      toast.error("Nome da agência é obrigatório"); return;
    }
    if (form.cnpj.trim() && !isValidCnpj(form.cnpj)) {
      setCnpjError("CNPJ inválido");
      toast.error("CNPJ inválido"); return;
    }
    if (form.pix_key_type && form.pix_key.trim() &&
        !isValidPixKey(form.pix_key_type as PixKeyType, form.pix_key)) {
      setPixError("Chave PIX inválida para o tipo selecionado");
      toast.error("Chave PIX inválida"); return;
    }

    setSaving(true);
    try {
      const payload = {
        agency_name: form.agency_name.trim(),
        legal_name: form.legal_name.trim() || null,
        cnpj: form.cnpj.trim() ? onlyDigits(form.cnpj) : null,
        state_registration: form.state_registration.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_role: form.contact_role.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() ? onlyDigits(form.contact_phone) : null,
        address_zip: form.address_zip.trim() ? onlyDigits(form.address_zip) : null,
        address_street: form.address_street.trim() || null,
        address_number: form.address_number.trim() || null,
        address_complement: form.address_complement.trim() || null,
        address_neighborhood: form.address_neighborhood.trim() || null,
        address_city: form.address_city.trim() || null,
        address_state: form.address_state.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_agency: form.bank_agency.trim() || null,
        bank_account: form.bank_account.trim() || null,
        bank_account_type: form.bank_account_type || null,
        bank_account_holder_name: form.bank_account_holder_name.trim() || null,
        bank_account_holder_document: form.bank_account_holder_document.trim()
          ? onlyDigits(form.bank_account_holder_document) : null,
        pix_key_type: form.pix_key_type || null,
        pix_key: form.pix_key.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { data, error } = await supabase.functions.invoke("partner-update-profile", { body: payload });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao salvar");
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader />
      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button
            onClick={() => navigate("/parceiro")}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Perfil da agência</h1>
                <p className="text-sm text-muted-foreground">
                  Dados cadastrais e bancários usados no relacionamento comercial com a GoDalz.
                </p>
              </div>
            </div>
            <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ${
              status === "active"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {status}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/40 bg-card p-6 h-96 animate-pulse" />
        ) : (
          <form onSubmit={submit} className="space-y-6">
            {/* Empresa */}
            <Section icon={<Building2 className="h-4 w-4" />} title="Dados da empresa">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome fantasia*">
                  <Input value={form.agency_name} onChange={(e) => set("agency_name", e.target.value)} required minLength={2} />
                </Field>
                <Field label="Razão social">
                  <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
                </Field>
                <Field label="CNPJ" error={cnpjError}>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => { set("cnpj", formatCnpj(e.target.value)); if (cnpjError) setCnpjError(null); }}
                    onBlur={onCnpjBlur}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    maxLength={18}
                  />
                </Field>
                <Field label="Inscrição estadual">
                  <Input
                    value={form.state_registration}
                    onChange={(e) => set("state_registration", e.target.value)}
                    placeholder="ISENTO ou número"
                  />
                </Field>
              </div>
            </Section>

            {/* Endereço */}
            <Section icon={<MapPin className="h-4 w-4" />} title="Endereço">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <Field label="CEP" className="sm:col-span-2">
                  <div className="relative">
                    <Input
                      value={form.address_zip}
                      onChange={(e) => set("address_zip", formatCep(e.target.value))}
                      onBlur={onZipBlur}
                      placeholder="00000-000"
                      inputMode="numeric"
                      maxLength={9}
                    />
                    {zipLoading && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </Field>
                <Field label="Rua" className="sm:col-span-4">
                  <Input value={form.address_street} onChange={(e) => set("address_street", e.target.value)} />
                </Field>
                <Field label="Número" className="sm:col-span-1">
                  <Input value={form.address_number} onChange={(e) => set("address_number", e.target.value)} />
                </Field>
                <Field label="Complemento" className="sm:col-span-2">
                  <Input value={form.address_complement} onChange={(e) => set("address_complement", e.target.value)} />
                </Field>
                <Field label="Bairro" className="sm:col-span-3">
                  <Input value={form.address_neighborhood} onChange={(e) => set("address_neighborhood", e.target.value)} />
                </Field>
                <Field label="Cidade" className="sm:col-span-4">
                  <Input value={form.address_city} onChange={(e) => set("address_city", e.target.value)} />
                </Field>
                <Field label="UF" className="sm:col-span-2">
                  <select
                    value={form.address_state}
                    onChange={(e) => set("address_state", e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            {/* Contato */}
            <Section icon={<User2 className="h-4 w-4" />} title="Contato">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome do responsável">
                  <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
                </Field>
                <Field label="Cargo">
                  <Input value={form.contact_role} onChange={(e) => set("contact_role", e.target.value)} placeholder="Ex.: Diretor comercial" />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.contact_phone}
                    onChange={(e) => set("contact_phone", formatBrPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                  />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
                </Field>
              </div>
            </Section>

            {/* Bancário e PIX */}
            <Section icon={<Landmark className="h-4 w-4" />} title="Dados bancários e PIX">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <Field label="Banco" className="sm:col-span-3">
                  <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Ex.: Itaú, Bradesco, Nubank" />
                </Field>
                <Field label="Agência" className="sm:col-span-1">
                  <Input value={form.bank_agency} onChange={(e) => set("bank_agency", e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Tipo de conta" className="sm:col-span-2">
                  <select
                    value={form.bank_account_type}
                    onChange={(e) => set("bank_account_type", e.target.value as Form["bank_account_type"])}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                </Field>
                <Field label="Conta" className="sm:col-span-3">
                  <SecretInput
                    value={form.bank_account}
                    onChange={(v) => set("bank_account", v)}
                    reveal={showBankAccount}
                    onToggle={() => setShowBankAccount((s) => !s)}
                    placeholder="Número da conta"
                  />
                </Field>
                <Field label="Titular da conta" className="sm:col-span-3">
                  <Input value={form.bank_account_holder_name} onChange={(e) => set("bank_account_holder_name", e.target.value)} />
                </Field>
                <Field label="CPF / CNPJ do titular" className="sm:col-span-3">
                  <Input
                    value={form.bank_account_holder_document}
                    onChange={(e) => set("bank_account_holder_document", formatCpfCnpj(e.target.value))}
                    inputMode="numeric"
                    maxLength={18}
                  />
                </Field>
                <Field label="Tipo de chave PIX" className="sm:col-span-3">
                  <select
                    value={form.pix_key_type}
                    onChange={(e) => { set("pix_key_type", e.target.value as Form["pix_key_type"]); setPixError(null); }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {PIX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Chave PIX" className="sm:col-span-3" error={pixError}>
                  <SecretInput
                    value={form.pix_key}
                    onChange={(v) => { set("pix_key", v); if (pixError) setPixError(null); }}
                    onBlur={onPixBlur}
                    reveal={showPixKey}
                    onToggle={() => setShowPixKey((s) => !s)}
                    placeholder="Chave PIX"
                  />
                </Field>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Usado exclusivamente para repasse de comissões pela GoDalz. Os dados ficam ocultos por padrão e só você e a equipe financeira da GoDalz têm acesso.
                </p>
              </div>
            </Section>

            {/* Observações */}
            <Section title="Observações internas">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Anotações que ajudem seu gerente de conta" />
            </Section>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O status da conta é gerenciado exclusivamente pela GoDalz HQ. Para alterações, entre em contato com seu gerente.
            </p>

            <div className="flex justify-end sticky bottom-4">
              <Button type="submit" disabled={saving} className="gap-2 shadow-lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6">
      <header className="flex items-center gap-2 pb-4 mb-4 border-b border-border/40">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-muted-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Field({ label, error, className, children }: {
  label: string; error?: string | null; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function SecretInput({ value, onChange, onBlur, reveal, onToggle, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  reveal: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        type={reveal ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="pr-9"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label={reveal ? "Ocultar" : "Mostrar"}
      >
        {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
