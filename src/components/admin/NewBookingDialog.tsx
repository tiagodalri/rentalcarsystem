import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLANS, PLAN_ORDER } from "@/data/rentalPlans";
import { Loader2, Upload } from "lucide-react";
import { CustomerCombobox, type CustomerLite } from "@/components/admin/CustomerCombobox";

type Vehicle = { id: string; name: string; daily_price_usd: number };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "active", label: "Ativa" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

const PAYMENT_METHODS = [
  "Cartão de Crédito",
  "Cartão de Débito",
  "PIX",
  "Dinheiro",
  "Transferência Bancária",
  "Zelle",
  "Outro",
];

export function NewBookingDialog({ open, onOpenChange, onCreated }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);

  const handleSelectCustomer = (c: CustomerLite | null) => {
    setCustomer(c);
    if (c) {
      setForm((p) => ({
        ...p,
        customer_name: c.full_name,
        customer_email: c.email || "",
        customer_phone: c.phone || "",
      }));
    }
  };

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    vehicle_id: "",
    pickup_date: "",
    pickup_time: "10:00",
    return_date: "",
    return_time: "10:00",
    pickup_location: "",
    return_location: "",
    plan_id: "conforto",
    total_price: "",
    payment_method: "Cartão de Crédito",
    contract_url: "",
    status: "confirmed",
    notes: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    supabase
      .from("vehicles")
      .select("id, name, daily_price_usd")
      .eq("published", true)
      .order("name")
      .then(({ data }) => setVehicles((data as Vehicle[]) || []));
  }, [open]);

  // Auto-suggest total price when vehicle/dates change
  useEffect(() => {
    if (!form.vehicle_id || !form.pickup_date || !form.return_date) return;
    const veh = vehicles.find((v) => v.id === form.vehicle_id);
    if (!veh) return;
    const days = Math.max(
      1,
      Math.round(
        (new Date(form.return_date).getTime() - new Date(form.pickup_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const plan = PLANS[form.plan_id as keyof typeof PLANS];
    const suggested = (Number(veh.daily_price_usd) + (plan?.dailyExtra ?? 0)) * days;
    if (!form.total_price || Number(form.total_price) === 0) {
      set("total_price", suggested.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vehicle_id, form.pickup_date, form.return_date, form.plan_id]);

  const handleContractUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `contracts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("inspections").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("inspections").getPublicUrl(path);
      set("contract_url", data.publicUrl);
      toast({ title: "Contrato enviado" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.customer_name || !form.vehicle_id || !form.pickup_date || !form.return_date) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Availability check
    try {
      const { data: available, error: availErr } = await supabase.rpc("check_vehicle_availability", {
        p_vehicle_id: form.vehicle_id,
        p_pickup: form.pickup_date,
        p_return: form.return_date,
        p_exclude_id: null,
      });
      if (!availErr && available === false) {
        setSaving(false);
        toast({
          title: "Veículo indisponível",
          description: "Veículo já reservado nesse período. Escolha outras datas ou outro veículo.",
          variant: "destructive",
        });
        return;
      }
    } catch (e) {
      console.warn("availability check failed, prosseguindo:", e);
    }

    const payload = {
      customer_id: customer?.id || null,
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      vehicle_id: form.vehicle_id,
      pickup_date: form.pickup_date,
      pickup_time: form.pickup_time,
      return_date: form.return_date,
      return_time: form.return_time,
      pickup_location: form.pickup_location || null,
      return_location: form.return_location || null,
      plan_id: form.plan_id,
      total_price: form.total_price ? Number(form.total_price) : null,
      status: form.status,
      notes: form.notes || null,
      addons: {
        payment_method: form.payment_method,
        contract_url: form.contract_url || null,
        manual_entry: true,
      },
    };
    const { error } = await supabase.from("bookings").insert(payload);
    setSaving(false);
    if (error) {
      const msg = error.message?.includes("bookings_no_overlap")
        ? "Veículo já reservado nesse período. Escolha outras datas ou outro veículo."
        : error.message;
      toast({ title: "Erro ao criar reserva", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Reserva criada com sucesso" });
    onCreated();
    onOpenChange(false);
    setCustomer(null);
    setForm({
      customer_name: "", customer_email: "", customer_phone: "",
      vehicle_id: "", pickup_date: "", pickup_time: "10:00",
      return_date: "", return_time: "10:00",
      pickup_location: "", return_location: "",
      plan_id: "conforto", total_price: "",
      payment_method: "Cartão de Crédito", contract_url: "",
      status: "confirmed", notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova reserva manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Cliente */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cliente</h3>
            <div className="mb-3">
              <CustomerCombobox selected={customer} onSelect={handleSelectCustomer} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <Label>Nome completo *</Label>
                <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Veículo & Plano */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Veículo e plano</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Veículo *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} — ${Number(v.daily_price_usd).toFixed(0)}/dia
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={form.plan_id} onValueChange={(v) => set("plan_id", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_ORDER.map((id) => (
                      <SelectItem key={id} value={id}>
                        {PLANS[id].name} {PLANS[id].dailyExtra > 0 ? `(+$${PLANS[id].dailyExtra}/dia)` : "(grátis)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Datas */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Período</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Retirada *</Label>
                <Input type="date" value={form.pickup_date} onChange={(e) => set("pickup_date", e.target.value)} />
              </div>
              <div>
                <Label>Hora retirada</Label>
                <Input type="time" value={form.pickup_time} onChange={(e) => set("pickup_time", e.target.value)} />
              </div>
              <div>
                <Label>Devolução *</Label>
                <Input type="date" value={form.return_date} onChange={(e) => set("return_date", e.target.value)} />
              </div>
              <div>
                <Label>Hora devolução</Label>
                <Input type="time" value={form.return_time} onChange={(e) => set("return_time", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Local de retirada</Label>
                <Input value={form.pickup_location} onChange={(e) => set("pickup_location", e.target.value)} placeholder="Ex: MCO Aeroporto Orlando" />
              </div>
              <div>
                <Label>Local de devolução</Label>
                <Input value={form.return_location} onChange={(e) => set("return_location", e.target.value)} placeholder="Ex: MCO Aeroporto Orlando" />
              </div>
            </div>
          </section>

          {/* Pagamento */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pagamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Valor total (USD)</Label>
                <Input type="number" step="0.01" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Contrato */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contrato</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Enviando..." : "Anexar contrato (PDF/imagem)"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && handleContractUpload(e.target.files[0])}
                />
              </label>
              {form.contract_url && (
                <a href={form.contract_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate max-w-[300px]">
                  Ver contrato anexado
                </a>
              )}
            </div>
          </section>

          {/* Notas */}
          <section>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notas internas sobre essa reserva..." />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Criar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
