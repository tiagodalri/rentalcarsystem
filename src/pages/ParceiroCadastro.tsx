import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Handshake, Loader2, CheckCircle2, ArrowLeft, Building2, MapPin, User, MessageSquare,
} from "lucide-react";
import {
  formatCnpj, formatCep, formatBrPhone, onlyDigits, isValidCnpj,
} from "@/lib/brValidators";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Form = {
  agency_name: string;
  legal_name: string;
  cnpj: string;
  state_registration: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  message: string;
  honeypot: string; // bot bait
};

const EMPTY: Form = {
  agency_name: "", legal_name: "", cnpj: "", state_registration: "",
  address_zip: "", address_street: "", address_number: "", address_complement: "",
  address_neighborhood: "", address_city: "", address_state: "",
  contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
  message: "", honeypot: "",
};

export default function ParceiroCadastro() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onCepBlur = async () => {
    const cep = onlyDigits(form.address_zip);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d?.erro) {
        setForm((f) => ({
          ...f,
          address_street: d.logradouro || f.address_street,
          address_neighborhood: d.bairro || f.address_neighborhood,
          address_city: d.localidade || f.address_city,
          address_state: (d.uf || f.address_state).toUpperCase(),
        }));
      }
    } catch { /* silencioso */ }
    finally { setCepLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agency_name.trim() || form.agency_name.trim().length < 2) {
      toast.error("Informe o nome da agência."); return;
    }
    if (!form.contact_name.trim()) { toast.error("Informe o nome do contato."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      toast.error("E-mail inválido."); return;
    }
    if (onlyDigits(form.contact_phone).length < 10) { toast.error("Telefone inválido."); return; }
    if (form.cnpj.trim() && !isValidCnpj(form.cnpj)) { toast.error("CNPJ inválido."); return; }

    setSubmitting(true);
    const payload = {
      agency_name: form.agency_name.trim(),
      legal_name: form.legal_name.trim() || null,
      cnpj: form.cnpj.trim() ? onlyDigits(form.cnpj) : null,
      state_registration: form.state_registration.trim() || null,
      address_zip: form.address_zip.trim() ? onlyDigits(form.address_zip) : null,
      address_street: form.address_street.trim() || null,
      address_number: form.address_number.trim() || null,
      address_complement: form.address_complement.trim() || null,
      address_neighborhood: form.address_neighborhood.trim() || null,
      address_city: form.address_city.trim() || null,
      address_state: form.address_state.trim() ? form.address_state.trim().toUpperCase() : null,
      contact_name: form.contact_name.trim(),
      contact_role: form.contact_role.trim() || null,
      contact_email: form.contact_email.trim().toLowerCase(),
      contact_phone: form.contact_phone.trim(),
      message: form.message.trim() || null,
      honeypot: form.honeypot, // if bots fill it, backend silently ignores
    };
    const { data, error } = await supabase.functions.invoke("public-submit-partner-application", { body: payload });
    setSubmitting(false);
    if (error || !data?.ok) {
      const msg = (error as { context?: { status?: number } })?.context?.status === 409
        ? "Já existe uma solicitação em análise com esses dados."
        : (data?.error || error?.message || "Não foi possível enviar. Tente novamente.");
      toast.error(msg);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-500/15 items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Recebemos sua solicitação!</h1>
            <p className="text-sm text-muted-foreground">
              Nossa equipe vai analisar os dados da sua agência e entrar em contato pelo e-mail informado em breve.
            </p>
          </div>
          <Button asChild variant="outline"><Link to="/parceiro/login">Voltar ao login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <BrandLogo className="h-7" />
          <Button asChild variant="ghost" size="sm">
            <Link to="/parceiro/login"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao login</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">
            <Handshake className="h-3.5 w-3.5 text-primary" /> Portal de Parceiros
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight">
            Cadastre sua agência
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl">
            Preencha os dados abaixo para solicitar acesso ao portal. Nosso time analisa cada solicitação
            e retorna com o próximo passo. Dados bancários e de repasse são coletados depois, no portal autenticado.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {/* Honeypot invisível — não muda a UX pra humanos. */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.honeypot}
              onChange={(e) => set("honeypot", e.target.value)}
            />
          </div>

          <Section icon={Building2} title="Empresa">
            <Grid>
              <Field label="Nome fantasia *" full>
                <Input value={form.agency_name} onChange={(e) => set("agency_name", e.target.value)} required maxLength={200} />
              </Field>
              <Field label="Razão social">
                <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} maxLength={200} />
              </Field>
              <Field label="CNPJ">
                <Input
                  value={form.cnpj}
                  onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Inscrição estadual">
                <Input value={form.state_registration} onChange={(e) => set("state_registration", e.target.value)} maxLength={40} />
              </Field>
            </Grid>
          </Section>

          <Section icon={MapPin} title="Endereço (opcional)">
            <Grid>
              <Field label="CEP">
                <div className="relative">
                  <Input
                    value={form.address_zip}
                    onChange={(e) => set("address_zip", formatCep(e.target.value))}
                    onBlur={onCepBlur}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </Field>
              <Field label="Rua">
                <Input value={form.address_street} onChange={(e) => set("address_street", e.target.value)} />
              </Field>
              <Field label="Número">
                <Input value={form.address_number} onChange={(e) => set("address_number", e.target.value)} />
              </Field>
              <Field label="Complemento">
                <Input value={form.address_complement} onChange={(e) => set("address_complement", e.target.value)} />
              </Field>
              <Field label="Bairro">
                <Input value={form.address_neighborhood} onChange={(e) => set("address_neighborhood", e.target.value)} />
              </Field>
              <Field label="Cidade">
                <Input value={form.address_city} onChange={(e) => set("address_city", e.target.value)} />
              </Field>
              <Field label="UF">
                <select
                  value={form.address_state}
                  onChange={(e) => set("address_state", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </Field>
            </Grid>
          </Section>

          <Section icon={User} title="Contato">
            <Grid>
              <Field label="Nome do contato *">
                <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} required maxLength={150} />
              </Field>
              <Field label="Cargo">
                <Input value={form.contact_role} onChange={(e) => set("contact_role", e.target.value)} maxLength={100} />
              </Field>
              <Field label="E-mail *">
                <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} required maxLength={255} />
              </Field>
              <Field label="Telefone *">
                <Input
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", formatBrPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  required
                />
              </Field>
            </Grid>
          </Section>

          <Section icon={MessageSquare} title="Sua agência">
            <Field label="Conte sobre sua agência (opcional)" full>
              <Textarea
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Volume mensal aproximado, praças que atende, tipo de cliente..."
              />
            </Field>
          </Section>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">
              Ao enviar você concorda que analisemos os dados desta agência para fins de habilitação.
            </p>
            <Button type="submit" disabled={submitting} className="gold-gradient text-primary-foreground min-w-[200px]">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar solicitação
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({
  icon: Icon, title, children,
}: { icon: typeof Handshake; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label, children, full,
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
