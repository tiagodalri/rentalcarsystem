import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingRows } from "@/components/skeletons/LoadingRows";
import {
  Loader2,
  RefreshCcw,
  Download,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  FileText,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatPersonName } from "@/lib/formatName";

type ContractStatus =
  | "not_sent"
  | "generating"
  | "sent"
  | "partially_signed"
  | "signed"
  | "cancelled"
  | "failed";

type Row = {
  id: string;
  booking_number: string | null;
  pickup_date: string;
  return_date: string;
  customer_name: string;
  contract_status: ContractStatus;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  contract_signed_pdf_url: string | null;
  contract_error: string | null;
  clicksign_envelope_id: string | null;
  status: string;
};

const STATUS_META: Record<
  ContractStatus,
  { label: string; cls: string; icon: typeof Clock }
> = {
  not_sent: { label: "Não enviado", cls: "bg-muted text-muted-foreground border-border/40", icon: Clock },
  generating: { label: "Gerando", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Loader2 },
  sent: { label: "Aguardando cliente", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: Send },
  partially_signed: { label: "Parcialmente assinado", cls: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30", icon: Clock },
  signed: { label: "Assinado", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", cls: "bg-red-500/10 text-red-600 border-red-500/30", icon: XCircle },
  failed: { label: "Falhou", cls: "bg-red-500/10 text-red-600 border-red-500/30", icon: AlertTriangle },
};

const FILTERS: { value: "all" | ContractStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "sent", label: "Aguardando cliente" },
  { value: "partially_signed", label: "Parcial" },
  { value: "signed", label: "Assinados" },
  { value: "failed", label: "Falhou" },
  { value: "cancelled", label: "Cancelados" },
  { value: "not_sent", label: "Não enviados" },
];

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

const AdminContracts = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ContractStatus>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, booking_number, pickup_date, return_date, customer_name, contract_status, contract_sent_at, contract_signed_at, contract_signed_pdf_url, contract_error, clicksign_envelope_id, status",
      )
      .is("deleted_at", null)
      .order("contract_sent_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      toast.error("Erro ao carregar contratos.");
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.contract_status !== filter) return false;
      if (q) {
        const hay = `${r.booking_number ?? ""} ${r.customer_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    rows.forEach((r) => {
      c[r.contract_status] = (c[r.contract_status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const resend = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      const { error } = await supabase.functions.invoke("send-contract", {
        body: { booking_id: bookingId },
      });
      if (error) throw new Error(error.message);
      toast.success("Contrato reenviado.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reenviar.");
    } finally {
      setBusyId(null);
    }
  };

  const download = async (row: Row) => {
    if (!row.contract_signed_pdf_url) {
      toast.error("PDF assinado ainda não disponível.");
      return;
    }
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.storage
        .from("signed-contracts")
        .createSignedUrl(row.contract_signed_pdf_url, 60 * 10);
      if (error || !data?.signedUrl) throw new Error(error?.message || "Falha ao gerar link.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageHeader
          title="Contratos"
          subtitle="Acompanhe o status de assinatura de todos os contratos de locação."
        />
        <button
          onClick={() => navigate("/admin/contracts/template")}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border/50 bg-card hover:bg-accent text-sm font-medium transition-colors"
        >
          <FileText size={14} className="text-primary" />
          Modelo de contrato
        </button>
      </div>



      <div className="admin-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const count = counts[f.value] ?? 0;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border/50 hover:border-foreground/40"
                }`}
              >
                {f.label} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nº ou cliente"
                className="pl-8 h-9 w-56"
              />
            </div>
            <button
              onClick={load}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border/50 hover:bg-accent"
              title="Atualizar"
            >
              <RefreshCcw size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left admin-label border-b border-border/40">
                <th className="py-2 pr-3">Reserva</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Período</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Enviado</th>
                <th className="py-2 pr-3">Assinado</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border/40">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3 px-2">
                        <div className="h-4 w-full rounded bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState compact icon={FileText} title="Nenhum contrato encontrado" description="Não há contratos que correspondam aos filtros aplicados." />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const meta = STATUS_META[r.contract_status] ?? STATUS_META.not_sent;
                  const Icon = meta.icon;
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-accent/30">
                      <td className="py-2 pr-3 font-medium">
                        <Link to={`/admin/bookings/${r.id}`} className="hover:underline">
                          {r.booking_number || r.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{formatPersonName(r.customer_name)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {fmtDate(r.pickup_date)} → {fmtDate(r.return_date)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${meta.cls}`}
                        >
                          <Icon size={12} className={r.contract_status === "generating" ? "animate-spin" : ""} />
                          {meta.label}
                        </span>
                        {r.contract_error && (
                          <p className="text-[10px] text-red-500 mt-1 max-w-xs truncate" title={r.contract_error}>
                            {r.contract_error}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">{fmtDateTime(r.contract_sent_at)}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">{fmtDateTime(r.contract_signed_at)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.contract_status === "signed" && r.contract_signed_pdf_url && (
                            <button
                              onClick={() => download(r)}
                              disabled={busy}
                              className="h-8 px-2 inline-flex items-center gap-1 text-xs rounded-md border border-border/50 hover:bg-accent disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              PDF
                            </button>
                          )}
                          {["not_sent", "failed", "cancelled", "sent", "partially_signed"].includes(r.contract_status) && (
                            <button
                              onClick={() => resend(r.id)}
                              disabled={busy}
                              className="h-8 px-2 inline-flex items-center gap-1 text-xs rounded-md border border-border/50 hover:bg-accent disabled:opacity-50"
                              title={r.contract_status === "not_sent" ? "Enviar contrato" : "Reenviar"}
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              {r.contract_status === "not_sent" ? "Enviar" : "Reenviar"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminContracts;
