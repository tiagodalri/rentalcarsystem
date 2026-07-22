import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Handshake, ChevronDown, ChevronRight, UserPlus, User, Eye, EyeOff, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatCnpj, formatCpfCnpj, maskTail } from "@/lib/brValidators";

interface Partner {
  id: string;
  agency_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
  legal_name: string | null;
  cnpj: string | null;
  address_city: string | null;
  address_state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  bank_account_holder_name: string | null;
  bank_account_holder_document: string | null;
  pix_key_type: string | null;
  pix_key: string | null;
}

interface PartnerUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
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

const emptyUserForm = { user_full_name: "", user_email: "", user_password: "" };

export default function AdminPlatformPartners() {
  const [items, setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, PartnerUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<Record<string, boolean>>({});
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [addingUser, setAddingUser] = useState(false);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("partners")
      .select("*")
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

  const updUser = (k: keyof typeof emptyUserForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setUserForm((f) => ({ ...f, [k]: e.target.value }));

  const loadUsers = async (partnerId: string) => {
    setLoadingUsers((s) => ({ ...s, [partnerId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("platform-list-partner-users", {
        body: { partner_id: partnerId },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao listar usuários");
      setUsers((u) => ({ ...u, [partnerId]: (res.users ?? []) as PartnerUser[] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingUsers((s) => ({ ...s, [partnerId]: false }));
    }
  };

  const toggle = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setUserForm(emptyUserForm);
    if (!users[id]) loadUsers(id);
  };

  const addUser = async (partnerId: string) => {
    if (!userForm.user_email.trim() || !userForm.user_password || !userForm.user_full_name.trim()) {
      toast.error("Preencha nome, e-mail e senha");
      return;
    }
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("platform-add-partner-user", {
        body: {
          partner_id: partnerId,
          user_full_name: userForm.user_full_name.trim(),
          user_email: userForm.user_email.trim(),
          user_password: userForm.user_password,
        },
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao adicionar usuário");
      toast.success("Usuário vinculado");
      setUserForm(emptyUserForm);
      loadUsers(partnerId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAddingUser(false);
    }
  };

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
              {items.map((p) => {
                const isOpen = expandedId === p.id;
                const list = users[p.id] ?? [];
                const busy = loadingUsers[p.id];
                return (
                  <div key={p.id}>
                    <button
                      onClick={() => toggle(p.id)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/20 -mx-2 px-2 rounded-md transition-colors"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Handshake className="h-4 w-4 text-primary" />
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
                    </button>

                    {isOpen && (
                      <div className="ml-9 mb-4 pl-4 border-l border-border/40 space-y-5">
                        <RegistrationBlock partner={p} />
                        <BankBlock partner={p} />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-2">
                            Usuários vinculados
                          </p>
                          {busy ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                            </div>
                          ) : list.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Nenhum usuário vinculado ainda.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {list.map((u) => (
                                <li key={u.user_id} className="flex items-center gap-2 text-sm">
                                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate">{u.full_name || u.email || u.user_id}</span>
                                  {u.email && u.full_name && (
                                    <span className="text-xs text-muted-foreground truncate">· {u.email}</span>
                                  )}
                                  {u.last_sign_in_at && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70 shrink-0">
                                      último acesso {new Date(u.last_sign_in_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="rounded-lg border border-dashed border-border/60 p-3 bg-muted/10">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                            <UserPlus className="h-3 w-3" /> Adicionar novo usuário
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input placeholder="Nome completo" value={userForm.user_full_name} onChange={updUser("user_full_name")} />
                            <Input type="email" placeholder="E-mail" value={userForm.user_email} onChange={updUser("user_email")} />
                            <Input type="password" placeholder="Senha" value={userForm.user_password} onChange={updUser("user_password")} />
                          </div>
                          <div className="flex justify-end mt-2">
                            <Button size="sm" disabled={addingUser} onClick={() => addUser(p.id)} className="gap-2">
                              {addingUser && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Vincular usuário
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</span>
      <span className={`text-sm ${mono ? "tabular-nums font-mono" : ""} ${value ? "" : "text-muted-foreground/60"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function RegistrationBlock({ partner }: { partner: Partner }) {
  const addr = [partner.address_city, partner.address_state].filter(Boolean).join(" / ");
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
        <Building2 className="h-3 w-3" /> Dados cadastrais
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-border/40 bg-muted/10 p-3">
        <InfoRow label="Razão social" value={partner.legal_name} />
        <InfoRow label="CNPJ" value={partner.cnpj ? formatCnpj(partner.cnpj) : null} mono />
        <InfoRow label="Cidade / UF" value={addr || null} />
      </div>
    </div>
  );
}

function BankBlock({ partner }: { partner: Partner }) {
  const [reveal, setReveal] = useState(false);
  const has = Boolean(
    partner.bank_name || partner.bank_agency || partner.bank_account ||
    partner.pix_key || partner.bank_account_holder_name
  );
  if (!has) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
          <Landmark className="h-3 w-3" /> Dados bancários
        </p>
        <p className="text-xs text-muted-foreground italic">Parceiro ainda não preencheu dados bancários.</p>
      </div>
    );
  }
  const account = reveal ? (partner.bank_account || "—") : maskTail(partner.bank_account);
  const agency = reveal ? (partner.bank_agency || "—") : maskTail(partner.bank_agency, 3);
  const pix = reveal ? (partner.pix_key || "—") : maskTail(partner.pix_key, 4);
  const doc = reveal && partner.bank_account_holder_document
    ? formatCpfCnpj(partner.bank_account_holder_document)
    : maskTail(partner.bank_account_holder_document, 3);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold flex items-center gap-1.5">
          <Landmark className="h-3 w-3" /> Dados bancários
        </p>
        <button
          type="button"
          onClick={() => setReveal((s) => !s)}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40 transition-colors"
        >
          {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {reveal ? "Ocultar" : "Revelar"}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-border/40 bg-muted/10 p-3">
        <InfoRow label="Banco" value={partner.bank_name} />
        <InfoRow label="Agência" value={agency} mono />
        <InfoRow label="Conta" value={account} mono />
        <InfoRow label="Tipo" value={partner.bank_account_type === "poupanca" ? "Poupança" : partner.bank_account_type === "corrente" ? "Corrente" : null} />
        <InfoRow label="Titular" value={partner.bank_account_holder_name} />
        <InfoRow label="CPF/CNPJ titular" value={doc} mono />
        <InfoRow label="Tipo chave PIX" value={partner.pix_key_type ? partner.pix_key_type.toUpperCase() : null} />
        <InfoRow label="Chave PIX" value={pix} mono />
      </div>
    </div>
  );
}
