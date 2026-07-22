import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Building2 } from "lucide-react";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Form = {
  agency_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
};

const empty: Form = { agency_name: "", contact_name: "", contact_email: "", contact_phone: "", notes: "" };

export default function ParceiroPerfil() {
  const navigate = useNavigate();
  const [authorizing, setAuthorizing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("active");
  const [form, setForm] = useState<Form>(empty);

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
        .select("agency_name, contact_name, contact_email, contact_phone, notes, status")
        .eq("id", role.partner_id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setForm({
          agency_name: data.agency_name ?? "",
          contact_name: data.contact_name ?? "",
          contact_email: data.contact_email ?? "",
          contact_phone: data.contact_phone ?? "",
          notes: data.notes ?? "",
        });
        setStatus(data.status ?? "active");
      }
      setLoading(false);
    })();
  }, [navigate]);

  const upd = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agency_name.trim() || form.agency_name.trim().length < 2) {
      toast.error("Nome da agência é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-update-profile", {
        body: {
          agency_name: form.agency_name.trim(),
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
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
      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button
            onClick={() => navigate("/parceiro")}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold">Perfil da agência</h1>
              <p className="text-sm text-muted-foreground">
                Dados de contato exibidos para a equipe da GoDalz.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/40 bg-card p-6 h-64 animate-pulse" />
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
                Cadastro
              </span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold ${
                status === "active"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {status}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Nome da agência*</Label>
              <Input value={form.agency_name} onChange={upd("agency_name")} required minLength={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contato — nome</Label>
                <Input value={form.contact_name} onChange={upd("contact_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Contato — telefone</Label>
                <Input value={form.contact_phone} onChange={upd("contact_phone")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contato — e-mail</Label>
              <Input type="email" value={form.contact_email} onChange={upd("contact_email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={upd("notes")} rows={4} />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O status da conta é gerenciado exclusivamente pela GoDalz HQ. Para alterações,
              entre em contato com seu gerente.
            </p>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
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
