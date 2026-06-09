import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  vehicleId: string | null;
  onSaved?: () => void;
}

const TYPES = [
  { value: "accident", label: "Acidente" },
  { value: "theft", label: "Roubo" },
  { value: "vandalism", label: "Furto / Vandalismo" },
  { value: "breakdown", label: "Avaria mecânica" },
  { value: "fine", label: "Multa de trânsito" },
  { value: "damage", label: "Dano no veículo" },
  { value: "other", label: "Outro" },
];

const SEVERITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const INCIDENT_TYPE_ENUM: Record<string, string> = {
  accident: "accident",
  theft: "theft",
  vandalism: "vandalism",
  breakdown: "breakdown",
  fine: "fine",
  damage: "damage",
  other: "other",
};

export function BookingIncidentDialog({ open, onOpenChange, bookingId, vehicleId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "accident",
    severity: "medium",
    title: "",
    description: "",
    incident_date: new Date().toISOString().split("T")[0],
    estimated_cost: "",
    actual_cost: "",
    link_to_vehicle: true,
  });

  useEffect(() => {
    if (open) {
      setForm({
        type: "accident",
        severity: "medium",
        title: "",
        description: "",
        incident_date: new Date().toISOString().split("T")[0],
        estimated_cost: "",
        actual_cost: "",
        link_to_vehicle: true,
      });
    }
  }, [open]);

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Informe um título para a ocorrência", variant: "destructive" });
      return;
    }
    if (!vehicleId) {
      toast({ title: "Esta reserva não tem veículo vinculado", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      vehicle_id: vehicleId,
      booking_id: bookingId,
      type: INCIDENT_TYPE_ENUM[form.type] || "other",
      severity: form.severity,
      status: "open",
      title: form.title.trim(),
      description: form.description.trim() || null,
      incident_date: form.incident_date,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : 0,
      actual_cost: form.actual_cost ? Number(form.actual_cost) : 0,
      linked_to_vehicle: form.link_to_vehicle,
    };
    const { error } = await supabase.from("vehicle_incidents").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao registrar ocorrência", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ocorrência registrada" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-destructive" /> Registrar ocorrência
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Registre acidentes, sinistros, multas ou qualquer evento atípico desta reserva.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Colisão traseira na I-4"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Gravidade</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data</Label>
              <Input
                type="date"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="h-10 tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custo estimado</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                className="h-10 tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custo real</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0,00"
                value={form.actual_cost}
                onChange={(e) => setForm({ ...form, actual_cost: e.target.value })}
                className="h-10 tabular-nums"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhe o que ocorreu, envolvidos, providências, BO, etc."
              className="resize-none"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Vincular ao cadastro do veículo</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quando ativo, a ocorrência também aparece no histórico do carro. Desative para manter o registro apenas nesta reserva.
              </p>
            </div>
            <Switch
              checked={form.link_to_vehicle}
              onCheckedChange={(v) => setForm({ ...form, link_to_vehicle: v })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <AlertTriangle size={14} className="mr-1.5" />}
            Registrar ocorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
