import { useEffect, useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { BookingDateField } from "@/components/admin/BookingDateField";

type Vehicle = { id: string; name: string };

interface BookingEditable {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_id: string | null;
  pickup_date: string;
  return_date: string;
  pickup_location: string | null;
  return_location: string | null;
  total_price: number | null;
  status: string;
  notes: string | null;
  extra_driver: boolean | null;
  driver_age: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: BookingEditable;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "active", label: "Ativa" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

function toDateInput(iso: string) {
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export function EditBookingDialog({ open, onOpenChange, booking, onSaved }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: booking.customer_name || "",
    customer_email: booking.customer_email || "",
    customer_phone: booking.customer_phone || "",
    vehicle_id: booking.vehicle_id || "",
    pickup_date: toDateInput(booking.pickup_date),
    return_date: toDateInput(booking.return_date),
    pickup_location: booking.pickup_location || "",
    return_location: booking.return_location || "",
    total_price: booking.total_price != null ? String(booking.total_price) : "",
    status: booking.status || "confirmed",
    notes: booking.notes || "",
    extra_driver: !!booking.extra_driver,
    driver_age: booking.driver_age != null ? String(booking.driver_age) : "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      customer_name: booking.customer_name || "",
      customer_email: booking.customer_email || "",
      customer_phone: booking.customer_phone || "",
      vehicle_id: booking.vehicle_id || "",
      pickup_date: toDateInput(booking.pickup_date),
      return_date: toDateInput(booking.return_date),
      pickup_location: booking.pickup_location || "",
      return_location: booking.return_location || "",
      total_price: booking.total_price != null ? String(booking.total_price) : "",
      status: booking.status || "confirmed",
      notes: booking.notes || "",
      extra_driver: !!booking.extra_driver,
      driver_age: booking.driver_age != null ? String(booking.driver_age) : "",
    });
    supabase.from("vehicles").select("id,name").order("name").then(({ data }) => {
      setVehicles((data || []) as Vehicle[]);
    });
  }, [open, booking]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.customer_name || !form.pickup_date || !form.return_date) {
      toast({ title: "Campos obrigatórios", description: "Nome, retirada e devolução são obrigatórios.", variant: "destructive" });
      return;
    }
    if (parseDateOnly(form.return_date) < parseDateOnly(form.pickup_date)) {
      toast({ title: "Datas inválidas", description: "A devolução deve ser depois da retirada.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        vehicle_id: form.vehicle_id || null,
        pickup_date: form.pickup_date,
        return_date: form.return_date,
        pickup_location: form.pickup_location || null,
        return_location: form.return_location || null,
        total_price: form.total_price ? Number(form.total_price) : null,
        status: form.status,
        notes: form.notes || null,
        extra_driver: form.extra_driver,
        driver_age: form.driver_age ? Number(form.driver_age) : null,
      })
      .eq("id", booking.id);
    setSaving(false);
    if (error) {
      const msg = error.message?.includes("bookings_no_overlap") || error.message?.toLowerCase().includes("overlap")
        ? "Veículo já reservado nesse período. Escolha outras datas ou outro veículo."
        : error.message;
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Reserva atualizada", description: "As alterações foram salvas." });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reserva</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Veículo</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Retirada</Label>
                <BookingDateField value={form.pickup_date} onChange={(v) => set("pickup_date", v)} />
              </div>
              <div>
                <Label className="text-xs">Devolução</Label>
                <BookingDateField value={form.return_date} onChange={(v) => set("return_date", v)} />
              </div>
              <div>
                <Label className="text-xs">Local de retirada</Label>
                <AddressAutocomplete value={form.pickup_location} onChange={(v) => set("pickup_location", v)} />
              </div>
              <div>
                <Label className="text-xs">Local de devolução</Label>
                <AddressAutocomplete value={form.return_location} onChange={(v) => set("return_location", v)} />
              </div>
              <div>
                <Label className="text-xs">Valor total (USD)</Label>
                <Input type="number" step="0.01" inputMode="decimal" placeholder="0,00" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} className="tabular-nums" />
              </div>
              <div>
                <Label className="text-xs">Idade do condutor</Label>
                <Input type="number" inputMode="numeric" placeholder="" value={form.driver_age} onChange={(e) => set("driver_age", e.target.value)} className="tabular-nums" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="extra_driver"
                  type="checkbox"
                  checked={form.extra_driver}
                  onChange={(e) => set("extra_driver", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="extra_driver" className="text-xs cursor-pointer">Condutor adicional</Label>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs">Observações internas</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
