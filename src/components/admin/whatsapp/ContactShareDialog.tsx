import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppContact, isNotConfigured, isDeviceOffline } from "@/lib/zapi";
import { formatPersonName } from "@/lib/formatName";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  conversationId: string;
}

interface CustomerRow { id: string; full_name: string | null; phone: string | null }

export function ContactShareDialog({ open, onOpenChange, phone, conversationId }: Props) {
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [ph, setPh] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); setName(""); setPh(""); setTab("search"); }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "search") return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .ilike("full_name", `%${term}%`)
        .limit(20);
      if (cancelled) return;
      setResults((data || []) as CustomerRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [q, tab, open]);

  const canSend = useMemo(() => name.trim().length > 0 && ph.replace(/\D/g, "").length >= 8, [name, ph]);

  async function pick(c: CustomerRow) {
    if (!c.phone) return toast.error("Cliente sem telefone");
    setName(c.full_name || "");
    setPh(c.phone);
    setTab("manual");
  }

  async function send() {
    if (!canSend) return;
    setBusy(true);
    const res = await sendWhatsAppContact(phone, name.trim(), ph.replace(/\D/g, ""), conversationId);
    setBusy(false);
    if (res.ok && res.simulated) toast.success("Contato enviado", { description: "Modo demonstração." });
    else if (res.ok) toast.success("Contato enviado");
    else if (isNotConfigured(res)) return toast.error("Integração não configurada");
    else if (isDeviceOffline(res)) return toast.error("Celular offline");
    else return toast.error("Falha ao enviar contato");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Compartilhar contato
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border/40">
          <button
            className={`px-3 py-2 text-xs font-medium uppercase tracking-wider ${tab === "search" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
            onClick={() => setTab("search")}
          >Buscar cliente</button>
          <button
            className={`px-3 py-2 text-xs font-medium uppercase tracking-wider ${tab === "manual" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
            onClick={() => setTab("manual")}
          >Digitar</button>
        </div>

        {tab === "search" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do cliente" className="pl-9" />
            </div>
            <div className="max-h-[240px] overflow-auto -mx-1">
              {loading && <div className="p-4 text-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Buscando…</div>}
              {!loading && results.length === 0 && q.trim().length >= 2 && (
                <div className="p-4 text-center text-muted-foreground text-sm">Nenhum resultado</div>
              )}
              <ul>
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => pick(c)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-medium truncate">{formatPersonName(c.full_name || "—")}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.phone || "sem telefone"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <Label htmlFor="cname" className="text-xs">Nome</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva" />
            </div>
            <div>
              <Label htmlFor="cphone" className="text-xs">Telefone (com código do país)</Label>
              <Input id="cphone" value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+55 11 99999-9999" inputMode="tel" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={busy || !canSend}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enviar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
