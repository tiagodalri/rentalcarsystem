import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Handshake } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface Partner {
  id: string;
  agency_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
}

const emptyForm = {
  agency_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
  user_full_name: "",
  user_email: "",
  user_password: "",
};

export default function AdminPlatformPartners() {
  const [items, setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("partners")
      .select("id, agency_name, contact_name, contact_email, contact_phone, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Partner[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agency_name.trim()) { toast.error("Nome da agência é obrigatório"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("platform-create-partner", {
        body: {
          agency_name: form.agency_name.trim(),
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          notes: form.notes.trim() || null,
          user_full_name: form.user_full_name.trim() || undefined,
          user_email: form.user_email.trim() || undefined,
          user_password: form.user_password || undefined,
        },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar parceiro");
      toast.success("Parceiro criado");
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const upd = (k: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Parceiros"
        subtitle="Agências parceiras cross-tenant gerenciadas pela plataforma."
        actions={
          <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? "Cancelar" : "Novo parceiro"}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo parceiro</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nome da agência*</Label>
                <Input value={form.agency_name} onChange={upd("agency_name")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Contato — nome</Label>
                <Input value={form.contact_name} onChange={upd("contact_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Contato — telefone</Label>
                <Input value={form.contact_phone} onChange={upd("contact_phone")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Contato — e-mail</Label>
                <Input type="email" value={form.contact_email} onChange={upd("contact_email")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={upd("notes")} rows={3} />
              </div>

              <div className="md:col-span-2 pt-2 border-t border-border/40">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Primeiro usuário da agência (opcional)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={form.user_full_name} onChange={upd("user_full_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.user_email} onChange={upd("user_email")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Senha</Label>
                <Input type="password" value={form.user_password} onChange={upd("user_password")} />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar parceiro
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Parceiros cadastrados</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum parceiro ainda.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Handshake className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.agency_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.contact_name || p.contact_email || p.contact_phone || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.status}</p>
                    <p className="text-[11px] text-muted-foreground/70 tabular-nums">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
