import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Toll = {
  id: string;
  toll_datetime: string;
  location: string;
  amount: number;
  charged_to_customer: boolean;
};

export function BookingEpassTolls({ bookingId, transponder }: { bookingId: string; transponder?: string | null }) {
  const [tolls, setTolls] = useState<Toll[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("epass_tolls")
      .select("id,toll_datetime,location,amount,charged_to_customer")
      .eq("booking_id", bookingId)
      .order("toll_datetime");
    setTolls((data || []) as Toll[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [bookingId]);

  const total = tolls.reduce((s, t) => s + Number(t.amount), 0);
  const pendingTotal = tolls.filter((t) => !t.charged_to_customer).reduce((s, t) => s + Number(t.amount), 0);
  const pendingIds = tolls.filter((t) => !t.charged_to_customer).map((t) => t.id);

  const markCharged = async () => {
    if (pendingIds.length === 0) return;
    setMarking(true);
    const { error } = await supabase
      .from("epass_tolls")
      .update({ charged_to_customer: true, charged_at: new Date().toISOString() })
      .in("id", pendingIds);
    setMarking(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Marcado como cobrado", description: `${pendingIds.length} pedagios atualizados.` });
    load();
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground">Carregando pedagios E-Pass...</div>;
  }
  if (tolls.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Pedagios E-Pass</h3>
          {transponder && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1">
              #{transponder}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {tolls.length} pedagios · <span className="font-semibold text-foreground">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="overflow-auto max-h-80 rounded-lg border border-border/40">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Data/Hora</th>
              <th className="px-2 py-1.5 font-medium">Local</th>
              <th className="px-2 py-1.5 font-medium text-right">Valor</th>
              <th className="px-2 py-1.5 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {tolls.map((t) => (
              <tr key={t.id} className="border-t border-border/30">
                <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                  {new Date(t.toll_datetime).toLocaleString("pt-BR", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{t.location}</td>
                <td className="px-2 py-1 text-right tabular-nums">${Number(t.amount).toFixed(2)}</td>
                <td className="px-2 py-1 text-center">
                  {t.charged_to_customer ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Cobrado
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Pendente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingTotal > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">
            Pendente: <span className="font-semibold text-foreground tabular-nums">${pendingTotal.toFixed(2)}</span>
          </div>
          <Button size="sm" onClick={markCharged} disabled={marking}>
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Marcar como cobrado
          </Button>
        </div>
      )}
    </div>
  );
}
