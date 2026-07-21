import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Copy,
  Download,
  Link2,
  Loader2,
  Power,
  PowerOff,
  QrCode,
  Trash2,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LinkRow {
  id: string;
  slug: string;
  label: string | null;
  target_phone: string;
  prefilled_message: string | null;
  click_count: number;
  is_active: boolean;
  created_at: string;
}

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function generateSlug(length = 7): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[buf[i] % SLUG_ALPHABET.length];
  }
  return out;
}

function buildShortUrl(slug: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://godalz.com";
  return `${origin}/l/${slug}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export default function AdminWhatsAppLinks() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [qrLink, setQrLink] = useState<LinkRow | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_links")
      .select("id, slug, label, target_phone, prefilled_message, click_count, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar links", { description: error.message });
    } else {
      setRows((data as LinkRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      toast.error("Telefone inválido");
      return;
    }
    setSaving(true);
    let inserted: LinkRow | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const slug = generateSlug();
      const { data, error } = await supabase
        .from("whatsapp_links")
        .insert({
          slug,
          target_phone: cleanPhone,
          prefilled_message: message.trim() || null,
          label: label.trim() || null,
        })
        .select("id, slug, label, target_phone, prefilled_message, click_count, is_active, created_at")
        .single();

      if (!error && data) {
        inserted = data as LinkRow;
        break;
      }
      if (error && error.code !== "23505") {
        lastError = error.message;
        break;
      }
      lastError = error?.message ?? null;
    }

    setSaving(false);

    if (!inserted) {
      toast.error("Erro ao criar link", { description: lastError ?? "Tente novamente" });
      return;
    }

    setRows((prev) => [inserted!, ...prev]);
    setPhone("");
    setMessage("");
    setLabel("");
    setQrLink(inserted);
    toast.success("Link criado");
  };

  const toggleActive = async (row: LinkRow) => {
    const { error } = await supabase
      .from("whatsapp_links")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error("Não foi possível alterar", { description: error.message });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    );
    toast.success(row.is_active ? "Link desativado" : "Link reativado");
  };

  const deleteRow = async (row: LinkRow) => {
    if (!confirm(`Apagar o link ${row.slug}?`)) return;
    const { error } = await supabase.from("whatsapp_links").delete().eq("id", row.id);
    if (error) {
      const msg = /row-level security|permission/i.test(error.message)
        ? "Somente administradores podem apagar links."
        : error.message;
      toast.error("Não foi possível apagar", { description: msg });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Link apagado");
  };

  const downloadQr = () => {
    if (!qrLink) return;
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-${qrLink.slug}.png`;
    a.click();
  };

  const qrValue = useMemo(() => (qrLink ? buildShortUrl(qrLink.slug) : ""), [qrLink]);

  return (
    <div className="admin-page space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/admin/whatsapp"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para WhatsApp
          </Link>
          <h1 className="admin-h1 text-2xl md:text-3xl">Links de WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere links curtos com QR code para campanhas, com contagem de cliques.
          </p>
        </div>
      </div>

      <Card className="p-5 bg-card/80 border-border/30">
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="link-phone">Telefone (com DDI)</Label>
            <Input
              id="link-phone"
              inputMode="tel"
              placeholder="55 11 90000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-label">Rótulo / campanha (opcional)</Label>
            <Input
              id="link-label"
              placeholder="Ex: Instagram Novembro"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="link-message">Mensagem pré-preenchida (opcional)</Label>
            <Textarea
              id="link-message"
              rows={3}
              placeholder="Olá, tenho interesse em..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Gerar link
            </Button>
          </div>
        </form>
      </Card>

      <Card className="bg-card/80 border-border/30 overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length} {rows.length === 1 ? "link" : "links"} no total.
          </p>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum link criado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Rótulo</th>
                  <th className="text-left px-4 py-2 font-medium">Slug</th>
                  <th className="text-left px-4 py-2 font-medium">Telefone</th>
                  <th className="text-right px-4 py-2 font-medium">Cliques</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Criado</th>
                  <th className="text-right px-4 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const url = buildShortUrl(row.slug);
                  return (
                    <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-4 py-2 max-w-[180px] truncate">{row.label ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          /l/{row.slug}
                        </a>
                      </td>
                      <td className="px-4 py-2 tabular-nums">{row.target_phone}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.click_count}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            row.is_active
                              ? "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                              : "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                          }
                        >
                          {row.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Copiar link"
                            onClick={() => copyToClipboard(url)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Ver QR code"
                            onClick={() => setQrLink(row)}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title={row.is_active ? "Desativar" : "Ativar"}
                            onClick={() => toggleActive(row)}
                          >
                            {row.is_active ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Apagar"
                            onClick={() => deleteRow(row)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      <Dialog open={!!qrLink} onOpenChange={(open) => !open && setQrLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR code do link</DialogTitle>
            <DialogDescription>
              {qrLink?.label ?? `/l/${qrLink?.slug ?? ""}`}
            </DialogDescription>
          </DialogHeader>
          {qrLink && (
            <div className="space-y-4">
              <div
                ref={qrCanvasRef}
                className="flex items-center justify-center bg-white p-6 rounded-lg border border-border"
              >
                <QRCodeCanvas value={qrValue} size={220} includeMargin={false} level="M" />
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={qrValue} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(qrValue)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="gap-2" onClick={downloadQr}>
                  <Download className="w-4 h-4" /> Baixar PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
