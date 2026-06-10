import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

type VehicleOpt = { id: string; name: string; license_plate: string | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  vehicles: VehicleOpt[];
  defaultVehicleId?: string;
  defaultStartDate?: string;
};

const REASONS = [
  "Uso pessoal",
  "Empréstimo amigo",
  "Empréstimo familiar",
  "Manutenção interna",
  "Test drive",
  "Bloqueio operacional",
  "Outro",
];

export function InformalBookingDialog({
  open, onOpenChange, onCreated, vehicles, defaultVehicleId, defaultStartDate,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || "");
  const [reason, setReason] = useState(REASONS[0]);
  const [label, setLabel] = useState("");
  const [pickupDate, setPickupDate] = useState(defaultStartDate || "");
  const [returnDate, setReturnDate] = useState(defaultStartDate || "");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setVehicleId(defaultVehicleId || "");
      setPickupDate(defaultStartDate || "");
      setReturnDate(defaultStartDate || "");
      setReason(REASONS[0]);
      setLabel("");
      setNotes("");
      setPickupTime("10:00");
      setReturnTime("10:00");
    }
  }, [open, defaultVehicleId, defaultStartDate]);

  const submit = async () => {
    if (!vehicleId || !pickupDate || !returnDate) {
      toast({ title: "Preencha veículo e datas", variant: "destructive" });
      return;
    }
    if (returnDate < pickupDate) {
      toast({ title: "Data de devolução inválida", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: avail } = await supabase.rpc("check_vehicle_availability", {
        p_vehicle_id: vehicleId,
        p_pickup: pickupDate,
        p_return: returnDate,
      });
      if (avail === false) {
        toast({
          title: "Veículo indisponível",
          description: "Já existe reserva nesse período.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    } catch {}

    const customerName = label.trim() ? `[Bloqueio] ${label.trim()}` : `[Bloqueio] ${reason}`;
    const payload = {
      customer_id: null,
      customer_name: customerName,
      customer_email: null,
      customer_phone: null,
      vehicle_id: vehicleId,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      return_date: returnDate,
      return_time: returnTime,
      pickup_location: null,
      return_location: null,
      plan_id: "unico",
      total_price: 0,
      status: "confirmed",
      notes: notes || null,
      deposit_amount: 0,
      franchise_amount: 0,
      addons: {
        informal: true,
        manual_entry: true,
        reason,
      },
    };
    const { error } = await supabase.from("bookings").insert(payload);
    setSaving(false);
    if (error) {
      const msg = error.message?.includes("bookings_no_overlap")
        ? "Veículo já reservado nesse período."
        : error.message;
      toast({ title: "Erro ao bloquear data", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Data bloqueada na agenda" });
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock size={16} /> Reserva informal / Bloqueio
          </DialogTitle>
          <DialogDescription>
            Trave uma data de um carro sem precisar criar uma reserva paga (uso pessoal, amigo, familiar, manutenção etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.license_plate ? ` • ${v.license_plate}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Retirada</Label>
              <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Devolução</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Identificação (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: João (cunhado), Test drive cliente XYZ…"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
              placeholder="Detalhes internos…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Bloquear data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
