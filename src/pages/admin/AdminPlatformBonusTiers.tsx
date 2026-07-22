import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trophy, Trash2, Check, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { fmtUSD } from "@/lib/partnerFormat";
import { format } from "date-fns";

interface Tier {
  id: string;
  threshold_bookings: number;
  bonus_amount: number;
  label: string;
  is_active: boolean;
  sort_order: number;
}

interface AwardRow {
  id: string;
  partner_id: string;
  tier_id: string;
  earned_at: string;
  payout_status: "pending" | "paid";
  paid_at: string | null;
}

interface PartnerRef { id: string; agency_name: string }

const emptyForm = { threshold_bookings: "", bonus_amount: "", label: "", is_active: true, sort_order: "" };

export default function AdminPlatformBonusTiers() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [tRes, aRes, pRes] = await Promise.all([
      supabase
        .from("partner_bonus_tiers")
        .select("id, threshold_bookings, bonus_amount, label, is_active, sort_order")
        .order("threshold_bookings", { ascending: true }),
      supabase
        .from("partner_bonus_awards")
        .select("id, partner_id, tier_id, earned_at, payout_status, paid_at")
        .order("earned_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("partners").select("id, agency_name"),
    ]);
    setTiers((tRes.data ?? []) as Tier[]);
    setAwards((aRes.data ?? []) as AwardRow[]);
    const pMap: Record<string, string> = {};
    for (const p of ((pRes.data ?? []) as PartnerRef[])) pMap[p.id] = p.agency_name;
    setPartners(pMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const threshold = parseInt(form.threshold_bookings, 10);
    const bonus = parseFloat(form.bonus_amount);
    if (!Number.isFinite(threshold) || threshold <= 0) { toast.error("Threshold inválido"); return; }
    if (!Number.isFinite(bonus) || bonus < 0) { toast.error("Bônus inválido"); return; }
    if (!form.label.trim()) { toast.error("Rótulo obrigatório"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("partner_bonus_tiers").insert({
      threshold_bookings: threshold,
      bonus_amount: bonus,
      label: form.label.trim(),
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order, 10) || threshold,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Patamar criado");
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const toggleActive = async (t: Tier) => {
    const { error } = await supabase
      .from("partner_bonus_tiers")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const deleteTier = async (t: Tier) => {
    if (!confirm(`Excluir patamar "${t.label}"? Bônus já concedidos serão removidos.`)) return;
    const { error } = await supabase.from("partner_bonus_tiers").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Patamar excluído");
    load();
  };

  const markPaid = async (award: AwardRow, next: "paid" | "pending") => {
    setMarkingId(award.id);
    try {
      const { data, error } = await supabase.functions.invoke("mark-bonus-paid", {
        body: { award_id: award.id, status: next },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha");
      toast.success(next === "paid" ? "Marcado como pago" : "Revertido para pendente");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setMarkingId(null);
    }
  };

  const tierById = (id: string) => tiers.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bônus de parceiros"
        subtitle="Configure os patamares do programa de missões e libere pagamentos."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Patamares</CardTitle>
          </div>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4 mr-1" /> Novo patamar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <form onSubmit={submitTier} className="rounded-lg border border-border/40 bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Reservas necessárias</Label>
                  <Input
                    type="number" min={1}
                    value={form.threshold_bookings}
                    onChange={(e) => setForm({ ...form, threshold_bookings: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Bônus (US$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={form.bonus_amount}
                    onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Rótulo</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Ex.: Parceiro Ouro"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 text-sm">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  Ativo
                </label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Criar
                  </Button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum patamar cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t.threshold_bookings} reservas · {fmtUSD(t.bonus_amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                      {t.is_active ? "Ativo" : "Inativo"}
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => deleteTier(t)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Bônus conquistados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : awards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum parceiro conquistou bônus ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                    <th className="text-left py-2 px-2">Parceiro</th>
                    <th className="text-left py-2 px-2">Patamar</th>
                    <th className="text-right py-2 px-2">Bônus</th>
                    <th className="text-left py-2 px-2">Conquistado</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-right py-2 px-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {awards.map((a) => {
                    const t = tierById(a.tier_id);
                    const paid = a.payout_status === "paid";
                    return (
                      <tr key={a.id} className="border-b border-border/20 last:border-0">
                        <td className="py-2 px-2 font-medium">{partners[a.partner_id] ?? a.partner_id.slice(0, 8)}</td>
                        <td className="py-2 px-2">{t?.label ?? "—"}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmtUSD(t?.bonus_amount ?? 0)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground tabular-nums">
                          {format(new Date(a.earned_at), "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            paid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}>
                            {paid ? <Check size={12} /> : <Clock size={12} />}
                            {paid ? "Pago" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            variant={paid ? "ghost" : "default"}
                            disabled={markingId === a.id}
                            onClick={() => markPaid(a, paid ? "pending" : "paid")}
                          >
                            {markingId === a.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {paid ? "Reverter" : "Marcar pago"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
