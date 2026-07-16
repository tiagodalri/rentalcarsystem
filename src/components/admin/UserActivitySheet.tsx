import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  MapPin,
  Smartphone,
  Tablet,
  Monitor,
  LogIn,
  LogOut,
  MousePointerClick,
  FileText,
  Globe,
  Clock,
  Route,
  Fingerprint,
} from "lucide-react";
import { describeNavigation, describeDevice, friendlyEventType, fmtDuration } from "@/lib/activityLabels";

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
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
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
function eventAccent(type: string) {
  if (type.includes("login")) return "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20";
  if (type.includes("logout")) return "text-slate-500 bg-slate-500/10 ring-slate-500/20";
  if (type.includes("click")) return "text-blue-600 bg-blue-500/10 ring-blue-500/20";
  if (type.includes("form")) return "text-violet-600 bg-violet-500/10 ring-violet-500/20";
  if (type.includes("pageview")) return "text-primary bg-primary/10 ring-primary/20";
  return "text-muted-foreground bg-muted ring-border";
}
function deviceIcon(d: string | null) {
  if (d === "mobile") return Smartphone;
  if (d === "tablet") return Tablet;
  return Monitor;
}

export interface UserActivitySheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userKey: string | null;
  logs: LogRow[];
}

export function UserActivitySheet({ open, onOpenChange, userKey, logs }: UserActivitySheetProps) {
  const userLogs = useMemo(
    () => logs.filter((l) => (l.user_email || l.user_id || "anônimo") === userKey),
    [logs, userKey],
  );

  const info = userLogs[0];

  const stats = useMemo(() => {
    const total = userLogs.length;
    const pageviews = userLogs.filter((l) => l.event_type.includes("pageview")).length;
    const clicks = userLogs.filter((l) => l.event_type.includes("click")).length;
    const forms = userLogs.filter((l) => l.event_type.includes("form")).length;
    const logins = userLogs.filter((l) => l.event_type.includes("login")).length;
    const sessions = new Set(userLogs.map((l) => l.session_id).filter(Boolean)).size;
    const totalTimeMs = userLogs.reduce((acc, l) => acc + (l.duration_ms || 0), 0);
    return { total, pageviews, clicks, forms, logins, sessions, totalTimeMs };
  }, [userLogs]);

  const topPages = useMemo(() => {
    const m = new Map<string, number>();
    userLogs
      .filter((l) => l.event_type.includes("pageview") && l.path)
      .forEach((l) => m.set(l.path!, (m.get(l.path!) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [userLogs]);

  const devices = useMemo(() => {
    const m = new Map<string, { count: number; browser: string | null; os: string | null }>();
    userLogs.forEach((l) => {
      const key = `${l.device || "?"}|${l.browser || "?"}|${l.os || "?"}`;
      const cur = m.get(key);
      if (cur) cur.count++;
      else m.set(key, { count: 1, browser: l.browser, os: l.os });
    });
    return Array.from(m.entries()).map(([k, v]) => ({ key: k, device: k.split("|")[0], ...v }));
  }, [userLogs]);

  const locations = useMemo(() => {
    const m = new Map<string, { count: number; ip: string | null }>();
    userLogs.forEach((l) => {
      const key = [l.city, l.region, l.country].filter(Boolean).join(", ") || "";
      const cur = m.get(key);
      if (cur) cur.count++;
      else m.set(key, { count: 1, ip: l.ip });
    });
    return Array.from(m.entries()).map(([k, v]) => ({ label: k, ...v })).sort((a, b) => b.count - a.count);
  }, [userLogs]);

  const sessionsList = useMemo(() => {
    const m = new Map<string, { id: string; events: number; start: string; last: string; device: string | null }>();
    userLogs.forEach((l) => {
      if (!l.session_id) return;
      const cur = m.get(l.session_id);
      if (cur) {
        cur.events++;
        if (l.created_at > cur.last) cur.last = l.created_at;
        if (l.created_at < cur.start) cur.start = l.created_at;
      } else {
        m.set(l.session_id, { id: l.session_id, events: 1, start: l.created_at, last: l.created_at, device: l.device });
      }
    });
    return Array.from(m.values()).sort((a, b) => b.last.localeCompare(a.last));
  }, [userLogs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 sm:p-6 border-b border-border">
          <SheetTitle className="text-left">
            <div className="text-lg font-semibold">{info?.user_name || info?.user_email || userKey}</div>
            {info?.user_email && info?.user_name && (
              <div className="text-xs text-muted-foreground font-normal mt-0.5">{info.user_email}</div>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 sm:p-6 pb-3">
            {[
              { label: "Eventos", value: stats.total, icon: Activity },
              { label: "Sessões", value: stats.sessions, icon: Fingerprint },
              { label: "Páginas vistas", value: stats.pageviews, icon: Globe },
              { label: "Cliques", value: stats.clicks, icon: MousePointerClick },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border/60 bg-card p-3 flex flex-col items-center justify-center min-h-[80px]">
                <k.icon className="h-4 w-4 text-primary mb-1" />
                <div className="admin-kpi text-lg tabular-nums">{k.value}</div>
                <div className="admin-label text-[10px] text-center">{k.label}</div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="timeline" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-4 sm:mx-6 grid grid-cols-4 h-auto">
              <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
              <TabsTrigger value="pages">Páginas</TabsTrigger>
              <TabsTrigger value="devices">Dispositivos</TabsTrigger>
              <TabsTrigger value="sessions">Sessões</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="flex-1 overflow-hidden mt-3">
              <ScrollArea className="h-full px-4 sm:px-6 pb-6">
                <ol className="relative">
                  <span className="absolute left-[14px] top-3 bottom-3 w-px bg-border" aria-hidden />
                  {userLogs.map((l) => {
                    const nav = describeNavigation(l);
                    const dur = fmtDuration(l.duration_ms);
                    const EvIcon = eventIcon(l.event_type);
                    const DevIcon = deviceIcon(l.device);
                    const accent = eventAccent(l.event_type);
                    return (
                      <li key={l.id} className="relative pl-10 py-2">
                        <span className={`absolute left-0 top-2 h-7 w-7 rounded-full ring-2 ring-background flex items-center justify-center ${accent}`}>
                          <EvIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="rounded-md border border-border/50 bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wider">
                                  {friendlyEventType(l.event_type)}
                                </Badge>
                              </div>
                              <div className="text-sm text-foreground mt-1">{nav.title}</div>
                              {nav.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{nav.subtitle}</div>}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                                <span className="inline-flex items-center gap-1">
                                  <DevIcon className="h-3 w-3" />
                                  {describeDevice(l)}
                                </span>
                                {dur && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {dur}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[11px] font-medium">{relTime(l.created_at)}</div>
                              <div className="text-[10px] text-muted-foreground tabular-nums">{fmtTime(l.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {userLogs.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">Sem atividade registrada.</div>
                  )}
                </ol>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pages" className="flex-1 overflow-hidden mt-3">
              <ScrollArea className="h-full px-4 sm:px-6 pb-6">
                <div className="space-y-1.5">
                  {topPages.map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-card p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Route className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-mono truncate">{path}</span>
                      </div>
                      <Badge variant="outline" className="font-normal tabular-nums">{count}</Badge>
                    </div>
                  ))}
                  {topPages.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">Sem páginas visitadas.</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="devices" className="flex-1 overflow-hidden mt-3">
              <ScrollArea className="h-full px-4 sm:px-6 pb-6">
                <div className="space-y-3">
                  <div>
                    <div className="admin-label mb-2">Dispositivos utilizados</div>
                    <div className="space-y-1.5">
                      {devices.map((d) => {
                        const DI = deviceIcon(d.device);
                        const label = d.device === "mobile" ? "Celular" : d.device === "tablet" ? "Tablet" : "Computador";
                        return (
                          <div key={d.key} className="flex items-center justify-between rounded-md border border-border/50 bg-card p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <DI className="h-4 w-4 text-muted-foreground" />
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">· {d.browser || "?"} · {d.os || "?"}</span>
                            </div>
                            <Badge variant="outline" className="font-normal tabular-nums">{d.count}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="admin-label mb-2">Localizações</div>
                    <div className="space-y-1.5">
                      {locations.map((l) => (
                        <div key={l.label} className="flex items-center justify-between rounded-md border border-border/50 bg-card p-3">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{l.label}</span>
                            {l.ip && <span className="text-xs font-mono text-muted-foreground">· {l.ip}</span>}
                          </div>
                          <Badge variant="outline" className="font-normal tabular-nums">{l.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sessions" className="flex-1 overflow-hidden mt-3">
              <ScrollArea className="h-full px-4 sm:px-6 pb-6">
                <div className="space-y-1.5">
                  {sessionsList.map((s) => {
                    const DI = deviceIcon(s.device);
                    const dur = new Date(s.last).getTime() - new Date(s.start).getTime();
                    return (
                      <div key={s.id} className="rounded-md border border-border/50 bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <DI className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-mono">Sessão {s.id.slice(0, 8)}</span>
                          </div>
                          <Badge variant="outline" className="font-normal tabular-nums">{s.events} eventos</Badge>
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Início: {fmtTime(s.start)}</span>
                          <span>Fim: {fmtTime(s.last)}</span>
                          <span>Duração: {fmtDuration(dur) || ""}</span>
                        </div>
                      </div>
                    );
                  })}
                  {sessionsList.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">Sem sessões registradas.</div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
