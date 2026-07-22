import { useState } from "react";
import { Loader2, X, Copy, Check, MessageCircle, Send, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Vehicle = {
  id: string;
  name: string;
  locadora_name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  pickup_date: string;
  return_date: string;
};

export default function ProposalModal({ open, onClose, vehicle, pickup_date, return_date }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ share_url: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const reset = () => {
    setResult(null); setCopied(false);
    setName(""); setEmail(""); setPhone(""); setMessage("");
  };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "Nome do cliente é obrigatório", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-create-proposal", {
        body: {
          vehicle_id: vehicle.id,
          pickup_date, return_date,
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          customer_phone: phone.trim() || null,
          message: message.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao criar proposta");
      // Ensure share_url uses current origin (edge function relies on header, fallback here)
      const shareUrl = data.share_url && !data.share_url.startsWith("/proposta")
        ? data.share_url
        : `${window.location.origin}/proposta/${data.token}`;
      setResult({ share_url: shareUrl, token: data.token });
    } catch (e) {
      toast({
        title: "Erro ao gerar proposta",
        description: e instanceof Error ? e.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const whatsappUrl = () => {
    if (!result) return "#";
    const clean = phone.replace(/\D/g, "");
    const text = `Olá ${name.split(" ")[0]}! Preparei uma proposta especial pro seu aluguel do ${vehicle.name}. Confira: ${result.share_url}`;
    const base = clean.length >= 8 ? `https://wa.me/${clean}` : `https://wa.me/`;
    return `${base}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold">Proposta personalizada</p>
            <h3 className="text-base font-semibold truncate">{vehicle.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{vehicle.locadora_name}</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <div className="p-5 space-y-3.5">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Nome do cliente *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@email.com"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Telefone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 407..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Mensagem personalizada</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Ex: Seguro incluído, entrega no hotel..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm outline-none focus:border-primary/50 resize-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Datas travadas: <span className="tabular-nums font-medium text-foreground">{pickup_date}</span> → <span className="tabular-nums font-medium text-foreground">{return_date}</span>. O link expira em 7 dias.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={close} className="flex-1">Cancelar</Button>
              <Button
                onClick={submit}
                disabled={submitting}
                className="flex-1 gold-gradient text-primary-foreground font-bold uppercase tracking-widest text-xs gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Gerar link
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Proposta criada! Compartilhe o link abaixo.</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Link da proposta</label>
              <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30">
                <input
                  readOnly
                  value={result.share_url}
                  className="flex-1 min-w-0 bg-transparent text-xs outline-none tabular-nums"
                />
                <button
                  onClick={copy}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    copied ? "text-emerald-500" : "hover:bg-muted/60 text-muted-foreground"
                  )}
                  title="Copiar"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold uppercase tracking-widest transition-colors"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a
                href={result.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-xs font-semibold uppercase tracking-widest transition-colors"
              >
                <ExternalLink size={14} /> Ver
              </a>
            </div>
            <Button variant="ghost" onClick={close} className="w-full text-xs">Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
