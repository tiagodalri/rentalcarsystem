import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Users, MonitorSmartphone, Search, RefreshCw, MapPin, Smartphone, Tablet, Monitor, LogIn, LogOut, MousePointerClick, FileText, Edit3, Trash2, PlusCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  describeNavigation,
  describeDevice,
  friendlyEventType,
  friendlyAction,
  friendlyTable,
  fmtDuration,
} from "@/lib/activityLabels";

const ALLOWED_EMAIL = "admin@zeusrentalcar.com";

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

function eventColor(type: string) {
  if (type.includes("error") || type.includes("fail")) return "destructive";
  if (type.includes("login") || type.includes("auth")) return "default";
  if (type.includes("create") || type.includes("insert")) return "secondary";
  return "outline";
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

export default function AdminLogs() {
  const { user, loading } = useAdminAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const isAllowed = user?.email?.toLowerCase() === ALLOWED_EMAIL;

  const load = async () => {
    setRefreshing(true);
    const [{ data: act }, { data: aud }] = await Promise.all([
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setLogs((act as LogRow[]) || []);
    setAudit((aud as AuditRow[]) || []);
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
          setLogs((prev) => [payload.new as LogRow, ...prev].slice(0, 500));
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
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <div className="admin-kpi">{logs.length}</div>
              <div className="admin-label">Eventos recentes</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="admin-kpi">{users.length}</div>
              <div className="admin-label">Usuários ativos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="admin-card">
          <CardContent className="p-4 flex items-center gap-3">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            <div>
              <div className="admin-kpi">{sessions.length}</div>
              <div className="admin-label">Sessões</div>
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
        <TabsList>
          <TabsTrigger value="activity">Atividade ao vivo</TabsTrigger>
          <TabsTrigger value="audit">Alterações de dados</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card className="admin-card">
            <CardHeader><CardTitle className="text-base">Eventos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh]">
                <div className="divide-y divide-border">
                  {filtered.map((l) => {
                    const nav = describeNavigation(l);
                    const dur = fmtDuration(l.duration_ms);
                    return (
                      <div key={l.id} className="p-3 flex flex-wrap items-start gap-2 text-sm hover:bg-muted/30">
                        <Badge variant={eventColor(l.event_type) as any} className="shrink-0">
                          {friendlyEventType(l.event_type)}
                        </Badge>
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-medium">
                            <span className="text-foreground">{l.user_name || l.user_email || "Visitante"}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span>{nav.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {nav.subtitle}
                            {dur ? ` · Ficou ${dur} na página anterior` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {describeDevice(l)}
                            {(l.city || l.country) ? ` · ${[l.city, l.region, l.country].filter(Boolean).join(", ")}` : ""}
                            {l.ip ? ` · ${l.ip}` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">{fmtTime(l.created_at)}</div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhum evento registrado.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="admin-card">
            <CardHeader><CardTitle className="text-base">Alterações de dados ({audit.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[60vh]">
                <div className="divide-y divide-border">
                  {audit
                    .filter((a) => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return [a.table_name, a.action, a.actor_email, a.record_id]
                        .filter(Boolean)
                        .some((v) => String(v).toLowerCase().includes(q));
                    })
                    .map((a) => (
                      <div key={a.id} className="p-3 flex flex-wrap items-start gap-2 text-sm hover:bg-muted/30">
                        <Badge variant="outline" className="shrink-0">{friendlyAction(a.action)}</Badge>
                        <div className="flex-1 min-w-[200px]">
                          <div className="font-medium">
                            <span>{a.actor_email || "Sistema"}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span>{friendlyAction(a.action)} {friendlyTable(a.table_name)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Registro: {a.record_id.slice(0, 8)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">{fmtTime(a.created_at)}</div>
                      </div>
                    ))}
                  {audit.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma alteração registrada.</div>
                  )}
                </div>
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
                    <div key={u.email} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{u.name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums">{u.count} eventos</div>
                        <div className="text-xs text-muted-foreground">{fmtTime(u.last)}</div>
                      </div>
                    </div>
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
      </Tabs>
    </div>
  );
}
