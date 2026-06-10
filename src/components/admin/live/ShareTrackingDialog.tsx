import { useState } from "react";
import { Share2, Copy, Check, Loader2, X, Link2, Clock, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  vehicleId: string;
  vehicleName: string;
  open: boolean;
  onClose: () => void;
};

const EXPIRES_OPTIONS = [
  { label: "1 hora", hours: 1 },
  { label: "24 horas", hours: 24 },
  { label: "7 dias", hours: 24 * 7 },
  { label: "Sem expiração", hours: 0 },
];

export function ShareTrackingDialog({ vehicleId, vehicleName, open, onClose }: Props) {
  const [hours, setHours] = useState<number>(24);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{ url: string; token: string; expires_at: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-public-track-link", {
        body: { action: "create", vehicle_id: vehicleId, label: label || null, expires_hours: hours || null },
      });
      if (error || !data?.token) throw error || new Error("Falha ao gerar link");
      const url = `${window.location.origin}/share/track/${data.token}`;
      setGenerated({ url, token: data.token, expires_at: data.expires_at ?? null });
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível gerar o link", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generated?.url) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleRevoke = async () => {
    if (!generated?.token) return;
    if (!confirm("Tem certeza? O link deixará de funcionar imediatamente.")) return;
    try {
      await supabase.functions.invoke("create-public-track-link", {
        body: { action: "revoke", token: generated.token },
      });
      toast.success("Link revogado");
      setGenerated(null);
    } catch {
      toast.error("Não foi possível revogar");
    }
  };

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Compartilhar rastreamento</h3>
              <p className="text-[11px] text-muted-foreground">{vehicleName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!generated ? (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Etiqueta (opcional)
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex.: cliente João, mecânico do Sul…"
                  maxLength={80}
                  className="mt-1.5 w-full px-3 py-2 rounded-lg bg-accent/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock size={11} /> Expira em
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {EXPIRES_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setHours(opt.hours)}
                      className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                        hours === opt.hours
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-accent/30 border-border text-foreground hover:bg-accent/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground bg-accent/30 rounded-lg p-3 leading-relaxed flex items-start gap-2">
                <AlertCircle size={12} className="text-primary mt-0.5 shrink-0" />
                <span>
                  Qualquer pessoa com este link verá <strong>apenas a localização ao vivo deste veículo</strong> e a rota
                  da viagem atual. Sem login. Você pode revogar a qualquer momento.
                </span>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                {creating ? "Gerando…" : "Gerar link de compartilhamento"}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">Link público</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-foreground break-all bg-background/50 rounded px-2 py-1.5">
                    {generated.url}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
                    title="Copiar"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                {generated.expires_at && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock size={10} /> Expira em {new Date(generated.expires_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(generated.url, "_blank")}
                  className="flex-1 h-10 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-accent"
                >
                  Abrir prévia
                </button>
                <button
                  onClick={handleRevoke}
                  className="h-10 px-3 rounded-lg border border-red-500/30 text-red-500 text-sm font-semibold hover:bg-red-500/10 flex items-center gap-1.5"
                  title="Revogar link"
                >
                  <Trash2 size={13} /> Revogar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
