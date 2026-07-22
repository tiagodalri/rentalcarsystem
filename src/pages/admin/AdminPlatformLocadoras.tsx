import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface Locadora {
  id: string;
  name: string;
  legal_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string | null;
  created_at: string;
}

const emptyForm = {
  name: "",
  legal_name: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  admin_full_name: "",
  admin_email: "",
  admin_password: "",
};

export default function AdminPlatformLocadoras() {
  const [items, setItems] = useState<Locadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("locadoras")
      .select("id, name, legal_name, contact_email, contact_phone, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Locadora[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("platform-create-locadora", {
        body: {
          name: form.name.trim(),
          legal_name: form.legal_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          logo_url: form.logo_url.trim() || null,
          admin_full_name: form.admin_full_name.trim() || undefined,
          admin_email: form.admin_email.trim() || undefined,
          admin_password: form.admin_password || undefined,
        },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar locadora");
      toast.success("Locadora criada");
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const upd = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Locadoras"
        subtitle="Gestão de locadoras parceiras na plataforma."
        actions={
          <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? "Cancelar" : "Nova locadora"}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nova locadora</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome*</Label>
                <Input value={form.name} onChange={upd("name")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Razão social</Label>
                <Input value={form.legal_name} onChange={upd("legal_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail de contato</Label>
                <Input type="email" value={form.contact_email} onChange={upd("contact_email")} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.contact_phone} onChange={upd("contact_phone")} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Logo URL</Label>
                <Input value={form.logo_url} onChange={upd("logo_url")} />
              </div>

              <div className="md:col-span-2 pt-2 border-t border-border/40">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Primeiro admin (opcional)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={form.admin_full_name} onChange={upd("admin_full_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.admin_email} onChange={upd("admin_email")} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Senha</Label>
                <Input type="password" value={form.admin_password} onChange={upd("admin_password")} />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar locadora
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Locadoras cadastradas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma locadora ainda.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((l) => (
                <div key={l.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.legal_name || l.contact_email || l.contact_phone || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{l.status || "active"}</p>
                    <p className="text-[11px] text-muted-foreground/70 tabular-nums">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
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
