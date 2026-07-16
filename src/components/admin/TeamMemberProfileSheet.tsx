import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { JobTitleSelect } from "@/components/admin/JobTitleSelect";
import { formatPersonName } from "@/lib/formatName";
import {
  Shield, Eye, Edit3, Check, X, Mail, Phone, Briefcase, ClipboardCheck,
  LayoutDashboard, Car, CalendarRange, Users, Radio, BarChart3, Settings, DollarSign,
  UsersRound, Trash2, Save, Pencil, CheckCircle2, XCircle, ShieldCheck,
} from "lucide-react";

// ─── Definitions (mirror AdminTeam.tsx) ───────────────────────
const MENU_ITEMS = [
  { key: "dashboard",  label: "Dashboard",      icon: LayoutDashboard },
  { key: "live",       label: "Live",           icon: Radio },
  { key: "bookings",   label: "Reservas",       icon: CalendarRange },
  { key: "fleet",      label: "Frota",          icon: Car },
  { key: "customers",  label: "Clientes",       icon: Users },
  { key: "finance",    label: "Financeiro",     icon: DollarSign },
  { key: "team",       label: "Equipe",         icon: UsersRound },
  { key: "report",     label: "Relatório",      icon: BarChart3 },
  { key: "settings",   label: "Configurações",  icon: Settings },
] as const;

const CAPABILITIES = [
  { key: "create_bookings",   label: "Criar reservas",         group: "Reservas" },
  { key: "edit_bookings",     label: "Editar reservas",        group: "Reservas" },
  { key: "delete_bookings",   label: "Excluir reservas",       group: "Reservas" },
  { key: "manage_fleet",      label: "Gerenciar frota",        group: "Frota" },
  { key: "add_vehicles",      label: "Adicionar veículos",     group: "Frota" },
  { key: "manage_expenses",   label: "Registrar despesas",     group: "Frota" },
  { key: "manage_incidents",  label: "Abrir ocorrências",      group: "Frota" },
  { key: "run_inspections",   label: "Realizar inspeções",     group: "Inspeções" },
  { key: "manage_customers",  label: "Gerenciar clientes",     group: "Clientes" },
  { key: "view_finance",      label: "Visualizar financeiro",  group: "Financeiro" },
  { key: "manage_team",       label: "Gerenciar equipe",       group: "Equipe" },
  { key: "manage_settings",   label: "Alterar configurações",  group: "Sistema" },
] as const;

type Permissions = {
  menus: string[];
  access_level: "viewer" | "editor" | "admin";
  capabilities: string[];
};

const DEFAULT_PERMISSIONS: Permissions = { menus: ["dashboard"], access_level: "viewer", capabilities: [] };
const ADMIN_PERMISSIONS: Permissions = {
  menus: MENU_ITEMS.map((m) => m.key),
  access_level: "admin",
  capabilities: CAPABILITIES.map((c) => c.key),
};

// Sensible default permission templates per role
const ROLE_TEMPLATES: Record<string, Permissions> = {
  admin: ADMIN_PERMISSIONS,
  finance: {
    access_level: "editor",
    menus: ["dashboard", "bookings", "customers", "finance", "report"],
    capabilities: ["view_finance", "manage_customers", "edit_bookings"],
  },
  operations: {
    access_level: "editor",
    menus: ["dashboard", "live", "bookings", "fleet", "customers"],
    capabilities: ["create_bookings", "edit_bookings", "manage_fleet", "manage_expenses", "manage_incidents", "run_inspections", "manage_customers"],
  },
  support: {
    access_level: "editor",
    menus: ["dashboard", "bookings", "customers"],
    capabilities: ["create_bookings", "edit_bookings", "manage_customers"],
  },
  driver: {
    access_level: "viewer",
    menus: ["dashboard", "live", "fleet"],
    capabilities: ["run_inspections", "manage_incidents"],
  },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  finance: "Financeiro",
  operations: "Operacional",
  support: "Atendimento",
  driver: "Operador de rua",
};

export type TeamMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  job_title_id: string | null;
  is_active: boolean;
  notes: string | null;
  permissions: Permissions | null;
  created_at: string;
  last_login_at: string | null;
};

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const formatLastLogin = (iso: string | null): string => {
  if (!iso) return "Nunca acessou";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `Há ${days} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: TeamMember | null;
  canEdit?: boolean;
  onChanged?: () => void;
};

export function TeamMemberProfileSheet({ open, onOpenChange, member, canEdit = true, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (member) {
      setForm({ ...member, permissions: member.permissions || DEFAULT_PERMISSIONS });
      setEditing(false);
    }
  }, [member]);

  const perms = useMemo<Permissions>(() => form?.permissions || DEFAULT_PERMISSIONS, [form]);

  if (!form) return null;

  const setPerms = (p: Permissions) => setForm({ ...form, permissions: p });

  const handleRoleChange = (role: string) => {
    // When role changes, apply matching permission template to keep things consistent.
    const tpl = ROLE_TEMPLATES[role];
    setForm({ ...form, role, permissions: tpl ? { ...tpl } : form.permissions });
  };

  const setAccessLevel = (level: "viewer" | "editor" | "admin") => {
    if (level === "admin") setForm({ ...form, role: "admin", permissions: { ...ADMIN_PERMISSIONS } });
    else setPerms({ ...perms, access_level: level });
  };

  const toggleMenu = (key: string) => {
    const menus = perms.menus.includes(key) ? perms.menus.filter((m) => m !== key) : [...perms.menus, key];
    setPerms({ ...perms, menus });
  };
  const toggleCap = (key: string) => {
    const capabilities = perms.capabilities.includes(key) ? perms.capabilities.filter((c) => c !== key) : [...perms.capabilities, key];
    setPerms({ ...perms, capabilities });
  };

  const handleSave = async () => {
    if (!form.full_name?.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("team_members").update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        position: form.position || null,
        job_title_id: form.job_title_id,
        notes: form.notes || null,
        permissions: form.permissions as any,
        is_active: form.is_active,
      }).eq("id", form.id);
      if (error) throw error;
      toast({ title: "Perfil atualizado" });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const next = !form.is_active;
    setForm({ ...form, is_active: next });
    await supabase.from("team_members").update({ is_active: next }).eq("id", form.id);
    toast({ title: next ? "Membro ativado" : "Membro desativado" });
    onChanged?.();
  };

  const handleDelete = async () => {
    if (!confirm(`Remover ${formatPersonName(form.full_name)} da equipe?`)) return;
    await supabase.from("team_members").delete().eq("id", form.id);
    toast({ title: "Membro removido" });
    onOpenChange(false);
    onChanged?.();
  };

  const capGroups = CAPABILITIES.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [] as typeof CAPABILITIES[number][];
    acc[c.group].push(c);
    return acc;
  }, {} as Record<string, typeof CAPABILITIES[number][]>);

  const inputCls = "h-10 px-3 rounded-lg border border-border/40 bg-background text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 overflow-y-auto"
      >
        <SheetHeader className="sr-only"><SheetTitle>Perfil do membro</SheetTitle></SheetHeader>

        {/* Hero */}
        <div className="p-5 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
              {initials(form.full_name) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-tight truncate">{formatPersonName(form.full_name)}</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{form.position || ROLE_LABELS[form.role] || form.role}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <Shield size={10} /> {ROLE_LABELS[form.role] || form.role}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${form.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {form.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {form.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-col items-end gap-2">
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5">
                    <Pencil size={12} /> Editar
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={saving} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
                    <Save size={12} /> {saving ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {form.email && (
              <a href={`mailto:${form.email}`} className="h-10 rounded-lg bg-card border border-border/40 inline-flex items-center justify-center gap-1.5 text-xs font-medium">
                <Mail size={12} /> Email
              </a>
            )}
            {form.phone && (
              <a href={`tel:${form.phone.replace(/\D/g, "")}`} className="h-10 rounded-lg bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center gap-1.5 text-xs font-medium">
                <Phone size={12} /> Ligar
              </a>
            )}
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-3 mx-5 mt-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="p-5 space-y-4">
            {!editing ? (
              <div className="space-y-3">
                <Field label="Nome completo" value={formatPersonName(form.full_name)} />
                <Field label="E-mail" value={form.email || ""} />
                <Field label="Telefone" value={form.phone || ""} />
                <Field label="Função" value={ROLE_LABELS[form.role] || form.role} />
                <Field label="Cargo" value={form.position || ""} />
                <Field label="Observações" value={form.notes || ""} multiline />
              </div>
            ) : (
              <div className="space-y-3">
                <Labeled label="Nome completo *">
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="E-mail">
                  <input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="Telefone">
                  <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="Função">
                  <select value={form.role} onChange={(e) => handleRoleChange(e.target.value)} className={inputCls}>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <ShieldCheck size={10} /> Trocar a função aplica o conjunto de permissões padrão para esse perfil.
                  </p>
                </Labeled>
                <Labeled label={<span className="flex items-center gap-1.5"><Briefcase size={11} /> Cargo</span>}>
                  <JobTitleSelect
                    value={form.job_title_id}
                    onChange={(id, name) => setForm({ ...form, job_title_id: id, position: name || "" })}
                  />
                </Labeled>
                <Labeled label="Observações">
                  <textarea
                    value={form.notes || ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="px-3 py-2 rounded-lg border border-border/40 bg-background text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </Labeled>
              </div>
            )}
          </TabsContent>

          {/* PERMISSIONS TAB */}
          <TabsContent value="permissions" className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nível de Acesso</p>
              <div className="grid grid-cols-3 gap-2">
                {(["viewer", "editor", "admin"] as const).map((level) => {
                  const active = perms.access_level === level;
                  const Icon = level === "viewer" ? Eye : level === "editor" ? Edit3 : Shield;
                  const labels = { viewer: "Visualizador", editor: "Editor", admin: "Admin" } as const;
                  return (
                    <button
                      key={level}
                      disabled={!editing}
                      onClick={() => setAccessLevel(level)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        active ? "border-primary bg-primary/5" : "border-border/30 bg-card"
                      } ${editing ? "" : "opacity-80 cursor-default"}`}
                    >
                      {active && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check size={10} className="text-primary-foreground" />
                        </div>
                      )}
                      <Icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                      <span className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{labels[level]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {perms.access_level === "admin" ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Shield size={14} className="text-primary shrink-0" />
                <p className="text-[11px] text-primary/80">Administradores têm acesso total a todos os menus e funcionalidades.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Menus Acessíveis ({perms.menus.length}/{MENU_ITEMS.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MENU_ITEMS.map((item) => {
                      const active = perms.menus.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          disabled={!editing}
                          onClick={() => toggleMenu(item.key)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all ${
                            active ? "border-primary/40 bg-primary/8 text-primary" : "border-border/20 bg-muted/20 text-muted-foreground"
                          } ${editing ? "" : "opacity-80 cursor-default"}`}
                        >
                          <item.icon size={16} />
                          <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Funcionalidades ({perms.capabilities.length}/{CAPABILITIES.length})</p>
                  <div className="space-y-3">
                    {Object.entries(capGroups).map(([group, caps]) => (
                      <div key={group}>
                        <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">{group}</p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {caps.map((cap) => {
                            const active = perms.capabilities.includes(cap.key);
                            return (
                              <button
                                key={cap.key}
                                disabled={!editing}
                                onClick={() => toggleCap(cap.key)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                                  active ? "border-primary/30 bg-primary/8 text-primary" : "border-border/20 bg-muted/10 text-muted-foreground"
                                } ${editing ? "" : "opacity-80 cursor-default"}`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? "bg-primary border-primary" : "border-border/60"}`}>
                                  {active && <Check size={10} className="text-primary-foreground" />}
                                </div>
                                <span className="text-xs font-medium">{cap.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="p-5 space-y-3">
            <Field label="Último acesso" value={formatLastLogin(form.last_login_at)} />
            <Field label="Cadastrado em" value={new Date(form.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} />

            {canEdit && (
              <div className="pt-4 mt-4 border-t border-border/40 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gestão da conta</p>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div>
                    <p className="text-sm font-medium">Conta ativa</p>
                    <p className="text-[11px] text-muted-foreground">Desative para suspender o acesso sem remover o histórico.</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={handleToggleActive} />
                </div>
                <button
                  onClick={handleDelete}
                  className="w-full h-10 rounded-lg border border-destructive/30 text-destructive text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-destructive/5"
                >
                  <Trash2 size={12} /> Remover da equipe
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {editing && (
          <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-border/40 bg-background/95 backdrop-blur flex justify-end gap-2">
            <button onClick={() => { setForm({ ...member!, permissions: member!.permissions || DEFAULT_PERMISSIONS }); setEditing(false); }} className="h-10 px-4 rounded-lg border border-border/40 text-xs font-medium inline-flex items-center gap-1.5">
              <X size={12} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
              <Save size={12} /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm text-foreground ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}

function Labeled({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
      {children}
    </div>
  );
}
