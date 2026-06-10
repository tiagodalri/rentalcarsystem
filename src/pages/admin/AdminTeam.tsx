import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import { JobTitleSelect } from "@/components/admin/JobTitleSelect";
import { ManageJobTitlesDialog } from "@/components/admin/ManageJobTitlesDialog";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  UsersRound, Plus, X, Search, Pencil, Trash2, Phone, Mail, Shield, Briefcase, Settings2,
  CheckCircle2, XCircle, Eye, Edit3, Check,
  LayoutDashboard, Car, CalendarRange, Users, Radio, BarChart3, Settings, DollarSign, ClipboardCheck,
} from "lucide-react";

// ─── Permission Definitions ────────────────────────────────
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
  { key: "run_inspections",   label: "Realizar inspeções",     group: "Inspeções", icon: ClipboardCheck },
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

const DEFAULT_PERMISSIONS: Permissions = {
  menus: ["dashboard"],
  access_level: "viewer",
  capabilities: [],
};

const ADMIN_PERMISSIONS: Permissions = {
  menus: MENU_ITEMS.map((m) => m.key),
  access_level: "admin",
  capabilities: CAPABILITIES.map((c) => c.key),
};

const accessLevelLabels: Record<string, { label: string; desc: string }> = {
  viewer: { label: "Visualizador", desc: "Pode apenas visualizar dados, sem editar" },
  editor: { label: "Editor", desc: "Pode visualizar e editar dados permitidos" },
  admin:  { label: "Administrador", desc: "Acesso total a todas as funcionalidades" },
};

// ─── Types ──────────────────────────────────────────────────
type TeamMember = {
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

const formatLastLogin = (iso: string | null): string => {
  if (!iso) return "Nunca acessou";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  finance: "Financeiro",
  operations: "Operacional",
  support: "Atendimento",
};

const roleColors: Record<string, string> = {
  admin: "bg-primary/15 text-primary border-primary/20",
  finance: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  operations: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  support: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

type FormData = {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  position: string;
  job_title_id: string | null;
  notes: string;
  permissions: Permissions;
};

const emptyForm: FormData = {
  full_name: "", email: "", phone: "", role: "support", position: "", job_title_id: null, notes: "",
  permissions: { ...DEFAULT_PERMISSIONS },
};

// ─── Component ──────────────────────────────────────────────
export default function AdminTeam() {
  const { isAdmin } = useAdminAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [permTab, setPermTab] = useState<"menus" | "capabilities">("menus");
  const [manageOpen, setManageOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("team_members").select("*").order("created_at", { ascending: false });
    setMembers(((data || []) as unknown as TeamMember[]));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getPerms = (): Permissions => form.permissions || DEFAULT_PERMISSIONS;

  const toggleMenu = (key: string) => {
    const p = getPerms();
    const menus = p.menus.includes(key) ? p.menus.filter((m) => m !== key) : [...p.menus, key];
    setForm({ ...form, permissions: { ...p, menus } });
  };

  const toggleCapability = (key: string) => {
    const p = getPerms();
    const caps = p.capabilities.includes(key) ? p.capabilities.filter((c) => c !== key) : [...p.capabilities, key];
    setForm({ ...form, permissions: { ...p, capabilities: caps } });
  };

  const setAccessLevel = (level: "viewer" | "editor" | "admin") => {
    const p = getPerms();
    if (level === "admin") {
      setForm({ ...form, role: "admin", permissions: { ...ADMIN_PERMISSIONS } });
    } else {
      setForm({ ...form, permissions: { ...p, access_level: level } });
    }
  };

  const selectAllMenus = () => {
    const p = getPerms();
    const allSelected = MENU_ITEMS.every((m) => p.menus.includes(m.key));
    setForm({
      ...form,
      permissions: { ...p, menus: allSelected ? [] : MENU_ITEMS.map((m) => m.key) },
    });
  };

  const selectAllCaps = () => {
    const p = getPerms();
    const allSelected = CAPABILITIES.every((c) => p.capabilities.includes(c.key));
    setForm({
      ...form,
      permissions: { ...p, capabilities: allSelected ? [] : CAPABILITIES.map((c) => c.key) },
    });
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role,
      position: form.position || null,
      job_title_id: form.job_title_id,
      notes: form.notes || null,
      permissions: form.permissions as any,
    };

    if (editingId) {
      await supabase.from("team_members").update(payload).eq("id", editingId);
      toast({ title: "Membro atualizado" });
    } else {
      await supabase.from("team_members").insert(payload);
      toast({ title: "Membro adicionado" });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const handleEdit = (m: TeamMember) => {
    const perms = m.permissions || DEFAULT_PERMISSIONS;
    setForm({
      full_name: m.full_name,
      email: m.email || "",
      phone: m.phone || "",
      role: m.role,
      position: m.position || "",
      job_title_id: m.job_title_id || null,
      notes: m.notes || "",
      permissions: {
        menus: perms.menus || [],
        access_level: perms.access_level || "viewer",
        capabilities: perms.capabilities || [],
      },
    });
    setEditingId(m.id);
    setShowForm(true);
    setPermTab("menus");
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("team_members").update({ is_active: !current }).eq("id", id);
    toast({ title: current ? "Membro desativado" : "Membro ativado" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    await supabase.from("team_members").delete().eq("id", id);
    toast({ title: "Membro removido" });
    load();
  };

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: members.length,
    active: members.filter((m) => m.is_active).length,
    admins: members.filter((m) => m.role === "admin").length,
    agents: members.filter((m) => m.role === "support").length,
  };

  const perms = getPerms();

  // Group capabilities
  const capGroups = CAPABILITIES.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {} as Record<string, typeof CAPABILITIES[number][]>);

  const inputClass = "h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground tracking-tight flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" /> Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{stats.total} membros • {stats.active} ativos</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setManageOpen(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg border border-border/40 text-foreground hover:bg-muted transition-colors"
            >
              <Settings2 size={14} /> Gerenciar cargos
            </button>
          )}
          <button
            onClick={() => { setForm({ ...emptyForm, permissions: { ...DEFAULT_PERMISSIONS } }); setEditingId(null); setShowForm(true); setPermTab("menus"); }}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: UsersRound },
          { label: "Ativos", value: stats.active, icon: CheckCircle2 },
          { label: "Admins", value: stats.admins, icon: Shield },
          { label: "Atendimento", value: stats.agents, icon: UsersRound },
        ].map((s) => (
          <Card key={s.label} className="border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-medium text-foreground tabular-nums">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/20 bg-card overflow-hidden">
          <CardContent className="p-0">
            {/* Form header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <h3 className="text-sm font-medium text-foreground">{editingId ? "Editar Membro" : "Novo Membro"}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            {/* Basic info */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Nome completo *</label>
                  <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nome completo" className={inputClass + " w-full"} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">E-mail</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className={inputClass + " w-full"} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Telefone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (xxx) xxx-xxxx" className={inputClass + " w-full"} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Função</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass + " w-full"}>
                    {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block flex items-center gap-1.5"><Briefcase size={10} /> Cargo</label>
                  <JobTitleSelect
                    value={form.job_title_id}
                    onChange={(id, name) => setForm({ ...form, job_title_id: id, position: name || "" })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Observações</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas" className={inputClass + " w-full"} />
                </div>
              </div>

              {/* Permissions section */}
              <div className="border-t border-border/30 pt-4">
                <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
                  <Shield size={14} className="text-primary" /> Permissões de Acesso
                </h4>

                {/* Access Level */}
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nível de Acesso</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["viewer", "editor", "admin"] as const).map((level) => {
                      const active = perms.access_level === level;
                      const info = accessLevelLabels[level];
                      const LevelIcon = level === "viewer" ? Eye : level === "editor" ? Edit3 : Shield;
                      return (
                        <button
                          key={level}
                          onClick={() => setAccessLevel(level)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/30 hover:border-border/60 bg-card"
                          }`}
                        >
                          {active && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check size={10} className="text-primary-foreground" />
                            </div>
                          )}
                          <LevelIcon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                          <span className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{info.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight">{info.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tabs: Menus / Capabilities */}
                {perms.access_level !== "admin" && (
                  <>
                    <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/30 mb-3 w-fit">
                      <button
                        onClick={() => setPermTab("menus")}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${permTab === "menus" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Menus ({perms.menus.length}/{MENU_ITEMS.length})
                      </button>
                      <button
                        onClick={() => setPermTab("capabilities")}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${permTab === "capabilities" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Funcionalidades ({perms.capabilities.length}/{CAPABILITIES.length})
                      </button>
                    </div>

                    {permTab === "menus" ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Menus Acessíveis</p>
                          <button onClick={selectAllMenus} className="text-[10px] text-primary hover:text-primary/80 font-medium">
                            {MENU_ITEMS.every((m) => perms.menus.includes(m.key)) ? "Desmarcar todos" : "Selecionar todos"}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                          {MENU_ITEMS.map((item) => {
                            const active = perms.menus.includes(item.key);
                            return (
                              <button
                                key={item.key}
                                onClick={() => toggleMenu(item.key)}
                                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-center ${
                                  active
                                    ? "border-primary/40 bg-primary/8 text-primary"
                                    : "border-border/20 bg-muted/20 text-muted-foreground hover:border-border/40"
                                }`}
                              >
                                <item.icon size={16} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funcionalidades</p>
                          <button onClick={selectAllCaps} className="text-[10px] text-primary hover:text-primary/80 font-medium">
                            {CAPABILITIES.every((c) => perms.capabilities.includes(c.key)) ? "Desmarcar todos" : "Selecionar todos"}
                          </button>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(capGroups).map(([group, caps]) => (
                            <div key={group}>
                              <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">{group}</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                {caps.map((cap) => {
                                  const active = perms.capabilities.includes(cap.key);
                                  return (
                                    <button
                                      key={cap.key}
                                      onClick={() => toggleCapability(cap.key)}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                                        active
                                          ? "border-primary/30 bg-primary/8 text-primary"
                                          : "border-border/20 bg-muted/10 text-muted-foreground hover:border-border/40"
                                      }`}
                                    >
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                        active ? "bg-primary border-primary" : "border-border/60"
                                      }`}>
                                        {active && <Check size={10} className="text-primary-foreground" />}
                                      </div>
                                      <span className="text-[10px] font-medium">{cap.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {perms.access_level === "admin" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Shield size={14} className="text-primary shrink-0" />
                    <p className="text-[11px] text-primary/80">Administradores têm acesso total a todos os menus e funcionalidades.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-xs px-4 py-2 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
              <button onClick={handleSave} className="text-xs px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">{editingId ? "Salvar" : "Adicionar"}</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar membro..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
      </div>

      {/* Members list */}
      {loading ? (
        <CardGridSkeleton count={6} variant="team" />
      ) : filtered.length === 0 && members.length > 0 ? (
        <EmptyState icon={Search} title="Nenhum membro encontrado" description="Nenhum membro corresponde à busca atual." actionLabel="Limpar busca" onAction={() => setSearch("")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UsersRound} title="Nenhum membro na equipe" description="Adicione membros e defina permissões de acesso para cada função." actionLabel="Adicionar Membro" onAction={() => { setForm({ ...emptyForm, permissions: { ...DEFAULT_PERMISSIONS } }); setEditingId(null); setShowForm(true); setPermTab("menus"); }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((m) => {
            const mp = m.permissions || DEFAULT_PERMISSIONS;
            const menuCount = mp.menus?.length || 0;
            const capCount = mp.capabilities?.length || 0;
            const levelInfo = accessLevelLabels[mp.access_level || "viewer"];

            return (
              <Card key={m.id} className={`border-border/30 transition-all hover:shadow-md ${!m.is_active ? "opacity-50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{m.full_name}</p>
                        {m.position && <p className="text-[11px] text-muted-foreground">{m.position}</p>}
                      </div>
                    </div>
                    <span className={`text-[9px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleColors[m.role] || roleColors.support}`}>
                      {roleLabels[m.role] || m.role}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {m.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail size={11} /> <span className="truncate">{m.email}</span>
                      </div>
                    )}
                    {m.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone size={11} /> <span>{m.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Permissions summary */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {mp.access_level === "admin" ? <Shield size={9} /> : mp.access_level === "editor" ? <Edit3 size={9} /> : <Eye size={9} />}
                      {levelInfo?.label}
                    </span>
                    {mp.access_level !== "admin" && (
                      <>
                        <span className="text-[9px] text-muted-foreground/60">{menuCount} menus</span>
                        <span className="text-[9px] text-muted-foreground/60">•</span>
                        <span className="text-[9px] text-muted-foreground/60">{capCount} funções</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground/70">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.last_login_at ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    <span className="tabular-nums">Último acesso: {formatLastLogin(m.last_login_at)}</span>
                  </div>

                  {m.notes && <p className="text-[10px] text-muted-foreground/60 mb-3 line-clamp-2">{m.notes}</p>}

                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <button
                      onClick={() => handleToggleActive(m.id, m.is_active)}
                      className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${m.is_active ? "text-emerald-500 hover:text-emerald-600" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {m.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {m.is_active ? "Ativo" : "Inativo"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(m)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ManageJobTitlesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
