import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Users, MonitorSmartphone, Search, RefreshCw, MapPin, Smartphone, Tablet, Monitor, LogIn, LogOut, MousePointerClick, FileText, Edit3, Trash2, PlusCircle, Globe, ClipboardCheck, ArrowDownToLine, ArrowUpFromLine, Gauge, Fuel, Car, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/EmptyState";
import {
  describeNavigation,
  describeDevice,
  friendlyEventType,
  friendlyAction,
  friendlyTable,
  fmtDuration,
} from "@/lib/activityLabels";
import { UserActivitySheet } from "@/components/admin/UserActivitySheet";
import { ChevronRight } from "lucide-react";

const ALLOWED_EMAIL = "admin@rentalcarsystem.lovable.app";

type LogRow = {
  id: string;
  created_at: string;
  event_type: string;
  event_name: string | null;
  user_email: string | null;
  user_name: string | null;
  user_id: string | null;
  path: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ip: string | null;
  session_id: string | null;
  duration_ms: number | null;
  metadata: any;
};

function fmtTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function relTime(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

function eventIcon(type: string) {
  if (type.includes("login")) return LogIn;
  if (type.includes("logout")) return LogOut;
  if (type.includes("click")) return MousePointerClick;
  if (type.includes("form")) return FileText;
  if (type.includes("pageview")) return Globe;
  return Activity;
}

function deviceIcon(device: string | null) {
  if (device === "mobile") return Smartphone;
  if (device === "tablet") return Tablet;
  return Monitor;
}

function actionIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes("insert") || a.includes("create")) return PlusCircle;
  if (a.includes("delete")) return Trash2;
  return Edit3;
}

function eventAccent(type: string) {
  if (type.includes("login")) return "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20";
  if (type.includes("logout")) return "text-slate-500 bg-slate-500/10 ring-slate-500/20";
  if (type.includes("click")) return "text-blue-600 bg-blue-500/10 ring-blue-500/20";
  if (type.includes("form")) return "text-violet-600 bg-violet-500/10 ring-violet-500/20";
  if (type.includes("pageview")) return "text-primary bg-primary/10 ring-primary/20";
  return "text-muted-foreground bg-muted ring-border";
}

function formatLocation(l: { city: string | null; region: string | null; country: string | null }) {
  return [l.city, l.region, l.country].filter(Boolean).join(", ");
}


type AuditRow = {
  id: string;
  created_at: string;
  table_name: string;
  record_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  diff: any;
};

type InspectionRow = {
  id: string;
  booking_id: string;
  type: string;
  odometer_reading: number | null;
  fuel_level: string | null;
  agent_name: string | null;
  completed_at: string | null;
  created_at: string;
  location_address: string | null;
  notes: string | null;
  exterior_photos: any;
  damages: any;
  bookings: {
    booking_number: string | null;
    customer_name: string | null;
    pickup_date: string | null;
    return_date: string | null;
    vehicles: { name: string | null; license_plate: string | null; brand: string | null; model: string | null } | null;
  } | null;
};

export default function AdminLogs() {
  const { user, loading } = useAdminAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [inspFilter, setInspFilter] = useState<"all" | "checkin" | "checkout">("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const isAllowed = user?.email?.toLowerCase() === ALLOWED_EMAIL;

  const load = async () => {
    setRefreshing(true);
    const [{ data: act }, { data: aud }, { data: insp }] = await Promise.all([
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase
        .from("vehicle_inspections")
        .select("id,booking_id,type,odometer_reading,fuel_level,agent_name,completed_at,created_at,location_address,notes,exterior_photos,damages,bookings:booking_id(booking_number,customer_name,pickup_date,return_date,vehicles:vehicle_id(name,license_plate,brand,model))")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(500),
    ]);
    setLogs((act as LogRow[]) || []);
    setAudit((aud as AuditRow[]) || []);
    setInspections((insp as any[]) || []);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!isAllowed) return;
    load();
    const ch = supabase
      .channel("activity_logs_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 5000));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          setAudit((prev) => [payload.new as AuditRow, ...prev].slice(0, 500));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAllowed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      [l.event_type, l.event_name, l.user_email, l.user_name, l.path, l.city, l.country, l.ip]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [logs, search]);

  const users = useMemo(() => {
    const map = new Map<string, { email: string; name: string | null; count: number; last: string }>();
    logs.forEach((l) => {
      const key = l.user_email || l.user_id || "anônimo";
      const cur = map.get(key);
      if (cur) {
        cur.count++;
        if (l.created_at > cur.last) cur.last = l.created_at;
      } else {
        map.set(key, { email: key, name: l.user_name, count: 1, last: l.created_at });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.last.localeCompare(a.last));
  }, [logs]);

  const sessions = useMemo(() => {
    const map = new Map<string, { id: string; email: string | null; device: string | null; events: number; start: string; last: string }>();
    logs.forEach((l) => {
      if (!l.session_id) return;
      const cur = map.get(l.session_id);
      if (cur) {
        cur.events++;
        if (l.created_at > cur.last) cur.last = l.created_at;
        if (l.created_at < cur.start) cur.start = l.created_at;
      } else {
        map.set(l.session_id, {
          id: l.session_id,
          email: l.user_email,
          device: l.device,
          events: 1,
          start: l.created_at,
          last: l.created_at,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.last.localeCompare(a.last));
  }, [logs]);

  if (loading) return null;
  if (!isAllowed) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-shell space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="admin-h1">Painel de Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento de atividade, sessões e usuários em tempo real.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="admin-card">
          <CardContent className="flex min-h-[112px] items-center justify-center gap-3 p-4 text-center">
            <Activity className="h-5 w-5 text-primary" />
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="admin-kpi leading-[1.05]">{logs.length}</div>
              <div className="admin-label leading-[1.15]">Eventos recentes</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-card">
          <CardContent className="flex min-h-[112px] items-center justify-center gap-3 p-4 text-center">
            <Users className="h-5 w-5 text-primary" />
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="admin-kpi leading-[1.05]">{users.length}</div>
              <div className="admin-label leading-[1.15]">Usuários ativos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-card">
          <CardContent className="flex min-h-[112px] items-center justify-center gap-3 p-4 text-center">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="admin-kpi leading-[1.05]">{sessions.length}</div>
              <div className="admin-label leading-[1.15]">Sessões</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por usuário, evento, rota, IP..."
          className="pl-9 h-11"
        />
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="activity">Atividade ao vivo</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções realizadas</TabsTrigger>
          <TabsTrigger value="audit">Alterações de dados</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Linha do tempo de eventos</CardTitle>
              <Badge variant="outline" className="font-normal">{filtered.length} eventos</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[62vh]">
                <ol className="relative px-4 sm:px-6 py-4">
                  <span className="absolute left-[34px] sm:left-[42px] top-4 bottom-4 w-px bg-border" aria-hidden />
                  {filtered.map((l) => {
                    const nav = describeNavigation(l);
                    const dur = fmtDuration(l.duration_ms);
                    const EvIcon = eventIcon(l.event_type);
                    const DevIcon = deviceIcon(l.device);
                    const accent = eventAccent(l.event_type);
                    const location = formatLocation(l);
                    return (
                      <li key={l.id} className="relative pl-12 sm:pl-14 py-3 group">
                        <span className={`absolute left-0 sm:left-2 top-3 h-7 w-7 rounded-full ring-2 ring-background flex items-center justify-center ${accent}`}>
                          <EvIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors p-3 sm:p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{l.user_name || l.user_email || "Visitante"}</span>
                                <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wider">
                                  {friendlyEventType(l.event_type)}
                                </Badge>
                              </div>
                              <div className="text-sm text-foreground/90 mt-0.5">{nav.title}</div>
                              {(nav.subtitle || dur) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {nav.subtitle}
                                  {dur ? `${nav.subtitle ? " · " : ""}Ficou ${dur} na página anterior` : ""}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                                <span className="inline-flex items-center gap-1">
                                  <DevIcon className="h-3 w-3" />
                                  {describeDevice(l)}
                                </span>
                                {location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {location}
                                  </span>
                                )}
                                {l.ip && (
                                  <span className="inline-flex items-center gap-1 font-mono">
                                    <Globe className="h-3 w-3" />
                                    {l.ip}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-medium text-foreground">{relTime(l.created_at)}</div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">{fmtTime(l.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {filtered.length === 0 && (
                    <li>
                      <EmptyState compact icon={Activity} title="Nenhum evento registrado" description="Assim que a equipe interagir com o sistema, os eventos aparecem aqui em tempo real." />
                    </li>
                  )}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Alterações de dados</CardTitle>
              <Badge variant="outline" className="font-normal">{audit.length} registros</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[62vh]">
                <ol className="relative px-4 sm:px-6 py-4">
                  <span className="absolute left-[34px] sm:left-[42px] top-4 bottom-4 w-px bg-border" aria-hidden />
                  {audit
                    .filter((a) => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return [a.table_name, a.action, a.actor_email, a.record_id]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q));
                    })
                    .map((a) => {
                      const Icon = actionIcon(a.action);
                      const accent = a.action.toLowerCase().includes("delete")
                        ? "text-rose-600 bg-rose-500/10 ring-rose-500/20"
                        : a.action.toLowerCase().includes("insert") || a.action.toLowerCase().includes("create")
                        ? "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20"
                        : "text-amber-600 bg-amber-500/10 ring-amber-500/20";
                      return (
                        <li key={a.id} className="relative pl-12 sm:pl-14 py-3">
                          <span className={`absolute left-0 sm:left-2 top-3 h-7 w-7 rounded-full ring-2 ring-background flex items-center justify-center ${accent}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors p-3 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground">
                                  {a.actor_email || "Sistema"}
                                </div>
                                <div className="text-sm text-foreground/90">
                                  {friendlyAction(a.action)} {friendlyTable(a.table_name)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  Registro: {a.record_id.slice(0, 8)}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-medium text-foreground">{relTime(a.created_at)}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">{fmtTime(a.created_at)}</div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  {audit.length === 0 && (
                    <li>
                      <EmptyState compact icon={Edit3} title="Nenhuma alteração registrada" description="Edições e exclusões feitas no sistema aparecem aqui automaticamente." />
                    </li>
                  )}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="users">
          <Card className="admin-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh]">
                <div className="divide-y divide-border">
                  {users.map((u) => (
                    <button
                      key={u.email}
                      onClick={() => setSelectedUser(u.email)}
                      className="w-full text-left p-3 flex items-center justify-between text-sm hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name || u.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className="text-right flex items-center gap-2 shrink-0">
                        <div>
                          <div className="tabular-nums">{u.count} eventos</div>
                          <div className="text-xs text-muted-foreground">{fmtTime(u.last)}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card className="admin-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh]">
                <div className="divide-y divide-border">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.email || "Visitante"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.device === "mobile" ? "Celular" : s.device === "tablet" ? "Tablet" : s.device === "desktop" ? "Computador" : "Aparelho"} · Sessão {s.id.slice(0, 6)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tabular-nums">{s.events} eventos</div>
                        <div className="text-xs text-muted-foreground">{fmtTime(s.last)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card className="admin-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-base">Inspeções realizadas</CardTitle>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs">
                  {(["all", "checkin", "checkout"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setInspFilter(f)}
                      className={`px-2.5 py-1 rounded-md transition-colors ${inspFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {f === "all" ? "Todas" : f === "checkin" ? "Retiradas" : "Devoluções"}
                    </button>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="font-normal">
                {inspections.filter((i) => inspFilter === "all" || i.type === inspFilter).length} inspeções
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[62vh]">
                <ol className="relative px-4 sm:px-6 py-4">
                  <span className="absolute left-[34px] sm:left-[42px] top-4 bottom-4 w-px bg-border" aria-hidden />
                  {inspections
                    .filter((i) => inspFilter === "all" || i.type === inspFilter)
                    .filter((i) => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return [
                        i.agent_name,
                        i.bookings?.booking_number,
                        i.bookings?.customer_name,
                        i.bookings?.vehicles?.name,
                        i.bookings?.vehicles?.license_plate,
                        i.location_address,
                      ]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q));
                    })
                    .map((i) => {
                      const isCheckin = i.type === "checkin";
                      const Icon = isCheckin ? ArrowDownToLine : ArrowUpFromLine;
                      const accent = isCheckin
                        ? "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20"
                        : "text-blue-600 bg-blue-500/10 ring-blue-500/20";
                      const when = i.completed_at || i.created_at;
                      const photos = Array.isArray(i.exterior_photos) ? i.exterior_photos.length : 0;
                      const damages = Array.isArray(i.damages) ? i.damages.length : 0;
                      const veh = i.bookings?.vehicles;
                      const vehLabel = veh?.name || [veh?.brand, veh?.model].filter(Boolean).join(" ") || "Veículo";
                      return (
                        <li key={i.id} className="relative pl-12 sm:pl-14 py-3">
                          <span className={`absolute left-0 sm:left-2 top-3 h-7 w-7 rounded-full ring-2 ring-background flex items-center justify-center ${accent}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors p-3 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`font-normal text-[10px] uppercase tracking-wider ${accent}`}>
                                    {isCheckin ? "Retirada" : "Devolução"}
                                  </Badge>
                                  {i.bookings?.booking_number && (
                                    <Link
                                      to={`/admin/bookings/${i.booking_id}`}
                                      className="text-sm font-medium text-foreground hover:underline"
                                    >
                                      {i.bookings.booking_number}
                                    </Link>
                                  )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-2 text-sm text-foreground/90">
                                  <Car className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{vehLabel}</span>
                                  {veh?.license_plate && (
                                    <span className="font-mono text-xs text-muted-foreground">· {veh.license_plate}</span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{i.bookings?.customer_name || "Cliente"}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                                  <span className="inline-flex items-center gap-1">
                                    <ClipboardCheck className="h-3 w-3" />
                                    Operador: <span className="text-foreground">{i.agent_name || "—"}</span>
                                  </span>
                                  {i.odometer_reading != null && (
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                      <Gauge className="h-3 w-3" />
                                      {i.odometer_reading.toLocaleString("pt-BR")} mi
                                    </span>
                                  )}
                                  {i.fuel_level && (
                                    <span className="inline-flex items-center gap-1 capitalize">
                                      <Fuel className="h-3 w-3" />
                                      {i.fuel_level}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {photos} fotos{damages > 0 ? ` · ${damages} avarias` : ""}
                                  </span>
                                  {i.location_address && (
                                    <span className="inline-flex items-center gap-1 max-w-[280px] truncate">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{i.location_address}</span>
                                    </span>
                                  )}
                                </div>
                                {i.notes && (
                                  <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-border pl-2">
                                    "{i.notes}"
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-medium text-foreground">{relTime(when)}</div>
                                <div className="text-[10px] text-muted-foreground tabular-nums">{fmtTime(when)}</div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  {inspections.filter((i) => inspFilter === "all" || i.type === inspFilter).length === 0 && (
                    <li>
                      <EmptyState compact icon={ClipboardCheck} title="Nenhuma inspeção registrada" description="Check-ins e check-outs feitos pelos operadores aparecerão aqui." />
                    </li>
                  )}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserActivitySheet
        open={!!selectedUser}
        onOpenChange={(o) => !o && setSelectedUser(null)}
        userKey={selectedUser}
        logs={logs}
      />
    </div>
  );
}
