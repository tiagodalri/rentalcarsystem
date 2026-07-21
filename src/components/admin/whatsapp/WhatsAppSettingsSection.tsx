import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  MessageSquare,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  checkWhatsAppStatus,
  disconnectWhatsApp,
  getWhatsAppQrCode,
  getZapiConfigStatus,
  isDeviceOffline,
  isNotConfigured,
  restartWhatsAppInstance,
  runWhatsAppHeartbeat,
  saveZapiConfig,
  type ZapiConfigInput,
  type ZapiConfigStatus,
} from "@/lib/zapi";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";

const WEBHOOK_URL_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/zapi-webhook`;

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55"))
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+${d}`;
}

function StatusDot({ status, configured }: { status?: string; configured: boolean }) {
  if (!configured) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
        Não configurado
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    connected: { label: "Conectado", cls: "text-emerald-600", dot: "bg-emerald-500" },
    connecting: { label: "Conectando", cls: "text-amber-600", dot: "bg-amber-500" },
    disconnected: { label: "Desconectado", cls: "text-muted-foreground", dot: "bg-muted-foreground/60" },
  };
  const info = map[status ?? "disconnected"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${info.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

function QrCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresIn, setExpiresIn] = useState(20);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await getWhatsAppQrCode();
    setBusy(false);
    if (isNotConfigured(res)) {
      toast.error("Configure as credenciais antes de gerar o QR Code");
      onOpenChange(false);
      return;
    }
    const raw = res.data as { value?: string; qrcode?: string } | string | undefined;
    let img: string | null = null;
    if (typeof raw === "string") img = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    else if (raw?.value) img = raw.value.startsWith("data:") ? raw.value : `data:image/png;base64,${raw.value}`;
    else if (raw?.qrcode) img = raw.qrcode.startsWith("data:") ? raw.qrcode : `data:image/png;base64,${raw.qrcode}`;
    if (!img) { toast.error("Não foi possível gerar QR Code"); return; }
    setQr(img);
    setExpiresIn(20);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setExpiresIn((v) => { if (v <= 1) { load(); return 20; } return v - 1; });
    }, 1000);
    if (pollRef.current) window.clearInterval(pollRef.current);
    startRef.current = Date.now();
    pollRef.current = window.setInterval(async () => {
      if (Date.now() - startRef.current > 3 * 60 * 1000) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        return;
      }
      const s = await runWhatsAppHeartbeat();
      if (s.data && (s.data as { connected?: boolean }).connected) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        if (timerRef.current) window.clearInterval(timerRef.current);
        toast.success("WhatsApp conectado");
        onOpenChange(false);
      }
    }, 3000);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) load();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (timerRef.current) window.clearInterval(timerRef.current);
      setQr(null);
    };
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {busy && !qr ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground my-8" />
          ) : qr ? (
            <>
              <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56 rounded-lg border" />
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                Abra WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
              </p>
              <p className="text-[11px] text-muted-foreground">Atualiza em {expiresIn}s</p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WhatsAppSettingsSection() {
  const { connection } = useWhatsAppConnection();
  const [status, setStatus] = useState<ZapiConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [form, setForm] = useState<ZapiConfigInput>({});
  const [initial, setInitial] = useState<ZapiConfigInput>({});

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const res = await getZapiConfigStatus();
    setLoading(false);
    if (!res.ok) {
      toast.error("Falha ao carregar configuração");
      return;
    }
    // The proxy returns fields at top-level, not inside .data.
    const s: ZapiConfigStatus = {
      configured: res.configured ?? false,
      source: res.source ?? "env",
      updated_at: res.updated_at ?? null,
      values: res.values ?? { instance_id: null, token: null, client_token: null, webhook_secret: null },
      has: res.has ?? { instance_id: false, token: false, client_token: false, webhook_secret: false },
    };
    setStatus(s);
    const initialForm: ZapiConfigInput = {
      instance_id: s.values.instance_id ?? "",
      token: s.values.token ?? "",
      client_token: s.values.client_token ?? "",
      webhook_secret: s.values.webhook_secret ?? "",
    };
    setForm(initialForm);
    setInitial(initialForm);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function handleSave() {
    setSaving(true);
    // Only send fields the user actually edited (different from the masked placeholder).
    const patch: ZapiConfigInput = {};
    (["instance_id", "token", "client_token", "webhook_secret"] as const).forEach((k) => {
      const v = (form[k] ?? "").trim();
      if (!v) return;
      if (v === (initial[k] ?? "")) return; // unchanged (still the mask)
      if (v.includes("•")) return; // safety net
      patch[k] = v;
    });
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      toast.info("Nada para salvar — nenhum campo foi alterado");
      return;
    }
    const res = await saveZapiConfig(patch);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Falha ao salvar configuração");
      return;
    }
    toast.success(`Configuração salva (${res.data?.updated ?? Object.keys(patch).length} campo(s))`);
    await loadStatus();
  }

  async function handleTest() {
    setBusy("test");
    const res = await runWhatsAppHeartbeat();
    setBusy(null);
    if (isNotConfigured(res)) { toast.error("Integração ainda não configurada"); return; }
    if (isDeviceOffline(res)) { toast.warning("Celular sem resposta (offline)"); return; }
    toast.success(res.data?.connected ? "Conectado ao WhatsApp" : "Credenciais válidas, aparelho desconectado");
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o WhatsApp?")) return;
    setBusy("disconnect");
    const res = await disconnectWhatsApp();
    setBusy(null);
    if (res.ok) toast.success("Desconectado"); else toast.error("Falha ao desconectar");
  }

  async function handleRestart() {
    setBusy("restart");
    const res = await restartWhatsAppInstance();
    setBusy(null);
    if (res.ok) toast.success("Instância reiniciada"); else toast.error("Falha ao reiniciar");
  }

  const configured = status?.configured ?? false;
  const isConnected = connection?.status === "connected";
  const webhookUrl = status?.has.webhook_secret && initial.webhook_secret && !initial.webhook_secret.includes("•")
    ? `${WEBHOOK_URL_BASE}?token=${encodeURIComponent(initial.webhook_secret)}`
    : status?.has.webhook_secret
    ? `${WEBHOOK_URL_BASE}?token=<seu_webhook_secret>`
    : null;

  const copyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("URL do webhook copiada");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <StatusDot status={connection?.status} configured={configured} />
              {isConnected && connection?.connected_phone && (
                <span className="text-xs text-muted-foreground">
                  {formatPhone(connection.connected_phone)}
                </span>
              )}
              {status?.source === "env" && configured && (
                <Badge variant="outline" className="text-[10px]">Via Secrets</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleTest} disabled={!!busy || !configured}>
                {busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Testar</span>
              </Button>
              {!isConnected ? (
                <Button size="sm" onClick={() => setQrOpen(true)} disabled={!configured}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Conectar via QR Code
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleRestart} disabled={!!busy}>
                    <RotateCcw className="w-4 h-4" /><span className="ml-2">Reiniciar</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={!!busy}>
                    <Power className="w-4 h-4" /><span className="ml-2">Desconectar</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Credenciais */}
          <div className="pt-4 border-t border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Credenciais da integração</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Os valores existentes ficam mascarados. Só reenvie o campo se realmente quiser trocar.
              Ao salvar em branco, o valor atual é mantido.
            </p>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="zapi-instance" className="text-xs">Instance ID</Label>
                  <Input
                    id="zapi-instance"
                    value={form.instance_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, instance_id: e.target.value }))}
                    placeholder="3D…"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zapi-token" className="text-xs">Token</Label>
                  <Input
                    id="zapi-token"
                    value={form.token ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                    placeholder="token da instância"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zapi-client-token" className="text-xs">Client Token</Label>
                  <Input
                    id="zapi-client-token"
                    value={form.client_token ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, client_token: e.target.value }))}
                    placeholder="Fxxxx…"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zapi-webhook" className="text-xs">Webhook Secret</Label>
                  <Input
                    id="zapi-webhook"
                    value={form.webhook_secret ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, webhook_secret: e.target.value }))}
                    placeholder="string aleatória para validar callbacks"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 gap-3 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                {status?.updated_at
                  ? `Atualizado em ${new Date(status.updated_at).toLocaleString("pt-BR")}`
                  : "Nunca salvo pelo painel"}
              </p>
              <Button size="sm" onClick={handleSave} disabled={saving || loading}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar credenciais
              </Button>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="pt-4 border-t border-border/40 space-y-2">
            <p className="text-sm font-medium">URL do webhook</p>
            <p className="text-xs text-muted-foreground">
              Cole esta URL no painel do provedor (todos os eventos: On Message Received, On Message Status,
              On Connected, On Disconnected). Se o Webhook Secret ainda não estiver salvo, salve primeiro para gerar a URL.
            </p>
            {webhookUrl ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-muted/50 px-3 py-2 rounded-md truncate">
                  {webhookUrl}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyWebhook}
                  disabled={webhookUrl.includes("<seu_webhook_secret>")}
                  title="Copiar"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Salve um Webhook Secret acima para gerar a URL completa.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <QrCodeDialog open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}
