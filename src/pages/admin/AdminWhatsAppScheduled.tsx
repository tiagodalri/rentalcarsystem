import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, ArrowLeft, Loader2, ExternalLink, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STAGE_BADGE_BASE } from "@/components/admin/whatsapp/stage";

type ScheduledStatus = "pending" | "sending" | "sent" | "cancelled" | "failed";

interface ScheduledRow {
  id: string;
  conversation_id: string;
  content: string | null;
  scheduled_for: string;
  status: ScheduledStatus;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
  whatsapp_conversations?: {
    contact_name: string | null;
    phone: string;
  } | null;
}

type Filter = "pending" | "sent" | "cancelled" | "failed" | "all";

const STATUS_BADGE: Record<ScheduledStatus, { label: string; cls: string; dot: string }> = {
  pending:   { label: "Agendada",  cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",     dot: "bg-amber-500" },
  sending:   { label: "Enviando",  cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",         dot: "bg-blue-500" },
  sent:      { label: "Enviada",   cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border",                                dot: "bg-muted-foreground/50" },
  failed:    { label: "Falhou",    cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30",              dot: "bg-red-500" },
};

export default function AdminWhatsAppScheduled() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("scheduled_messages")
      .select(
        "id, conversation_id, content, scheduled_for, status, sent_at, failure_reason, created_at, whatsapp_conversations(contact_name, phone)"
      )
      .order("scheduled_for", { ascending: true })
      .limit(200);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error("Falha ao carregar agendamentos");
    } else {
      setRows((data ?? []) as unknown as ScheduledRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function cancelRow(id: string) {
    setCancellingId(id);
    const { error } = await supabase
      .from("scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "pending");
    setCancellingId(null);
    if (error) {
      toast.error("Falha ao cancelar");
      return;
    }
    toast.success("Agendamento cancelado");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/whatsapp"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              WhatsApp
            </Link>
          </div>
          <h1 className="admin-h1 text-2xl md:text-3xl">Mensagens agendadas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envios programados para o WhatsApp. O sistema dispara automaticamente no horário.
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="pending">Agendadas</TabsTrigger>
          <TabsTrigger value="sent">Enviadas</TabsTrigger>
          <TabsTrigger value="failed">Falhas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="bg-card/80 border-border/30 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma mensagem {filter === "all" ? "" : `com status "${STATUS_BADGE[filter as ScheduledStatus]?.label.toLowerCase() ?? filter}"`}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Quando</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Contato</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Mensagem</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map((r) => {
                  const badge = STATUS_BADGE[r.status];
                  const contact = r.whatsapp_conversations;
                  const contactLabel = contact?.contact_name?.trim() || contact?.phone || "—";
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-foreground/90 whitespace-nowrap">
                        {format(new Date(r.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${STAGE_BADGE_BASE} ${badge.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                        {r.status === "failed" && r.failure_reason && (
                          <div className="text-[11px] text-red-500 mt-1 max-w-[280px] truncate" title={r.failure_reason}>
                            {r.failure_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground/90 whitespace-nowrap max-w-[220px] truncate">
                        {contactLabel}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[420px]">
                        <div className="line-clamp-2">{r.content || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link to="/admin/whatsapp">
                            <Button variant="ghost" size="sm" className="h-8 text-xs">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Abrir
                            </Button>
                          </Link>
                          {r.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-red-500 hover:text-red-600"
                              disabled={cancellingId === r.id}
                              onClick={() => cancelRow(r.id)}
                            >
                              {cancellingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <XIcon className="w-3.5 h-3.5 mr-1" />
                              )}
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Envio automático a cada minuto no horário programado.
      </div>
    </div>
  );
}
