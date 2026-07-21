import { useEffect, useState } from "react";
import { X, Tag, User, CalendarCheck, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { STAGES, stageInfo, tagClass, STAGE_BADGE_BASE } from "./stage";
import type { WhatsAppConversation, FunnelStage } from "@/hooks/useWhatsAppConversations";
import { formatPersonName } from "@/lib/formatName";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => any };

interface CustomerCtx {
  id: string;
  full_name: string | null;
  email: string | null;
  activeBookingId?: string | null;
  activeBookingUntil?: string | null;
}

export function ContextPanel({
  conversation,
  onClose,
}: {
  conversation: WhatsAppConversation;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState<CustomerCtx | null>(null);
  const [loadingCust, setLoadingCust] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!conversation.customer_id) {
        setCustomer(null);
        return;
      }
      setLoadingCust(true);
      const { data: c } = await anyClient
        .from("customers")
        .select("id, full_name, email")
        .eq("id", conversation.customer_id)
        .maybeSingle();
      const { data: b } = await anyClient
        .from("bookings")
        .select("id, return_date, status")
        .eq("customer_id", conversation.customer_id)
        .in("status", ["confirmed", "active", "in_progress"])
        .is("deleted_at", null)
        .order("return_date", { ascending: false })
        .limit(1);
      if (cancel) return;
      setCustomer(
        c
          ? {
              id: c.id,
              full_name: c.full_name,
              email: c.email,
              activeBookingId: b?.[0]?.id ?? null,
              activeBookingUntil: b?.[0]?.return_date ?? null,
            }
          : null,
      );
      setLoadingCust(false);
    })();
    return () => { cancel = true; };
  }, [conversation.customer_id]);

  async function updateStage(v: FunnelStage) {
    setSavingStage(true);
    const { error } = await anyClient
      .from("whatsapp_conversations")
      .update({ stage: v })
      .eq("id", conversation.id);
    setSavingStage(false);
    if (error) toast.error("Falha ao atualizar estágio");
  }

  async function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (conversation.tags.includes(t)) { setNewTag(""); return; }
    const next = [...conversation.tags, t];
    const { error } = await anyClient
      .from("whatsapp_conversations")
      .update({ tags: next })
      .eq("id", conversation.id);
    if (error) return toast.error("Falha ao adicionar tag");
    setNewTag("");
  }

  async function removeTag(t: string) {
    const next = conversation.tags.filter((x) => x !== t);
    await anyClient.from("whatsapp_conversations").update({ tags: next }).eq("id", conversation.id);
  }

  const display = conversation.contact_name ? formatPersonName(conversation.contact_name) : conversation.phone;

  return (
    <aside className="w-full lg:w-[340px] border-l bg-background flex flex-col min-h-0">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contexto</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-5 flex flex-col items-center border-b">
          <PersonAvatar name={conversation.contact_name || conversation.phone} size="2xl" tone="gold" />
          <div className="mt-3 text-base font-semibold text-center">{display}</div>
          <div className="text-xs text-muted-foreground">{conversation.phone}</div>
        </div>

        {/* Funnel stage */}
        <div className="p-4 border-b space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Estágio do funil
          </div>
          <Select value={conversation.stage} onValueChange={(v) => updateStage(v as FunnelStage)}>
            <SelectTrigger className="h-9">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stageInfo(conversation.stage).dot}`} />
                  {stageInfo(conversation.stage).label}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savingStage && <div className="text-[10px] text-muted-foreground">Salvando…</div>}
        </div>

        {/* Tags */}
        <div className="p-4 border-b space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma tag</span>
            )}
            {conversation.tags.map((t) => (
              <button
                key={t}
                onClick={() => removeTag(t)}
                className={`${STAGE_BADGE_BASE} ${tagClass(t)} transition-opacity hover:opacity-80`}
                title="Clique para remover"
              >
                {t}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="Nova tag"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={addTag} disabled={!newTag.trim()}>
              Adicionar
            </Button>
          </div>
        </div>

        {/* Customer */}
        <div className="p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <User className="w-3 h-3" /> Cliente GoDalz
          </div>
          {loadingCust ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
            </div>
          ) : customer ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-sm font-medium">
                {formatPersonName(customer.full_name || "")}
              </div>
              {customer.email && (
                <div className="text-[11px] text-muted-foreground truncate">{customer.email}</div>
              )}
              {customer.activeBookingId && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>
                    Reserva ativa
                    {customer.activeBookingUntil && (
                      <> até {new Date(customer.activeBookingUntil).toLocaleDateString("pt-BR")}</>
                    )}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1.5 pt-1">
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link to={`/admin/customers/${customer.id}`}>
                    Ver perfil do cliente <ExternalLink className="w-3 h-3" />
                  </Link>
                </Button>
                {customer.activeBookingId && (
                  <Button asChild size="sm" variant="outline" className="w-full justify-between">
                    <Link to={`/admin/bookings/${customer.activeBookingId}`}>
                      Ver reserva <ExternalLink className="w-3 h-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
              Conversa não vinculada a um cliente.
              <Badge variant="outline" className="mt-2 block w-fit mx-auto">
                Vínculo automático por telefone
              </Badge>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
