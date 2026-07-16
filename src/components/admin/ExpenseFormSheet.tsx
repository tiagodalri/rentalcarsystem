import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Upload, Save, Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatPersonName } from "@/lib/formatName";

type Vehicle = { id: string; name: string; license_plate: string | null };
type Booking = { id: string; booking_number: string | null; customer_name: string | null; pickup_date: string; return_date: string };

const EXPENSE_TYPES = [
  { value: "maintenance", label: "Manutenção / Mecânica" },
  { value: "fuel", label: "Combustível" },
  { value: "cleaning", label: "Lavagem / Detalhamento" },
  { value: "parts", label: "Peças" },
  { value: "insurance", label: "Seguro" },
  { value: "fine", label: "Multa" },
  { value: "documentation", label: "Documentação / Registro" },
  { value: "other", label: "Outros" },
];

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "zelle", label: "Zelle" },
  { value: "pix", label: "PIX" },
  { value: "bank_transfer", label: "Transferência bancária" },
  { value: "other", label: "Outro" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  defaultVehicleId?: string | null;
};

export function ExpenseFormSheet({ open, onOpenChange, onSaved, defaultVehicleId }: Props) {
  const [tab, setTab] = useState<"manual" | "ai">("manual");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const [form, setForm] = useState({
    vehicle_id: defaultVehicleId || "",
    booking_id: "none",
    type: "maintenance",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    supplier: "",
    description: "",
    payment_method: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setTab("manual");
    setReceiptFile(null);
    setReceiptPreview(null);
    setAiConfidence(null);
    setForm({
      vehicle_id: defaultVehicleId || "",
      booking_id: "none",
      type: "maintenance",
      amount: "",
      expense_date: new Date().toISOString().slice(0, 10),
      supplier: "",
      description: "",
      payment_method: "",
      notes: "",
    });

    (async () => {
      const { data: vs } = await supabase.rpc("list_vehicles_basic");
      setVehicles((vs || []).map((v: any) => ({ id: v.id, name: v.name, license_plate: v.license_plate })));
    })();
  }, [open, defaultVehicleId]);

  useEffect(() => {
    if (!form.vehicle_id) { setBookings([]); return; }
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id,booking_number,customer_name,pickup_date,return_date")
        .eq("vehicle_id", form.vehicle_id)
        .is("deleted_at", null)
        .order("pickup_date", { ascending: false })
        .limit(50);
      setBookings((data || []) as Booking[]);
    })();
  }, [form.vehicle_id]);

  const onFilePicked = async (f: File | null) => {
    if (!f) return;
    setReceiptFile(f);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const runOCR = async () => {
    if (!receiptFile) {
      toast({ title: "Selecione uma foto da nota", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = String(r.result || "");
          resolve(s.includes(",") ? s.split(",")[1] : s);
        };
        r.onerror = reject;
        r.readAsDataURL(receiptFile);
      });

      const { data, error } = await supabase.functions.invoke("parse-expense-receipt", {
        body: { fileBase64: base64, mimeType: receiptFile.type || "image/jpeg" },
      });
      if (error) throw error;
      const parsed = data?.data;
      if (!parsed) throw new Error("Não foi possível ler a nota.");

      setForm((f) => ({
        ...f,
        amount: parsed.amount != null ? String(parsed.amount) : f.amount,
        expense_date: parsed.expense_date || f.expense_date,
        supplier: parsed.supplier || f.supplier,
        type: parsed.type || f.type,
        description: parsed.description || f.description,
        payment_method: parsed.payment_method || f.payment_method,
      }));
      setAiConfidence(parsed.confidence ?? null);
      toast({ title: "Nota lida", description: "Revise os campos e confirme para salvar." });
    } catch (e: any) {
      toast({ title: "Falha no OCR", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const save = async (asDraft = false) => {
    if (!form.vehicle_id) return toast({ title: "Selecione o veículo", variant: "destructive" });
    if (!form.amount || Number(form.amount) <= 0) return toast({ title: "Informe o valor", variant: "destructive" });

    setSaving(true);
    try {
      let receipt_url: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "jpg";
        const path = `${form.vehicle_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("expense-receipts").upload(path, receiptFile, {
          contentType: receiptFile.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        receipt_url = path;
      }

      const { data: userData } = await supabase.auth.getUser();

      const payload: any = {
        vehicle_id: form.vehicle_id,
        booking_id: form.booking_id !== "none" ? form.booking_id : null,
        type: form.type,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        supplier: form.supplier || null,
        description: form.description || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        receipt_url,
        status: asDraft ? "draft" : "approved",
        source: tab === "ai" ? "ai_receipt" : "manual",
        created_by: userData.user?.id || null,
        ai_data: tab === "ai" && aiConfidence != null ? { confidence: aiConfidence } : null,
      };

      const { error } = await supabase.from("vehicle_expenses").insert(payload);
      if (error) throw error;

      toast({ title: asDraft ? "Rascunho salvo" : "Custo registrado" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registrar custo</SheetTitle>
          <SheetDescription>Vincule sempre a um veículo para métricas financeiras corretas.</SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Foto da nota (IA)</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4 space-y-3">
            <ReceiptPicker
              receiptFile={receiptFile}
              receiptPreview={receiptPreview}
              onFilePicked={onFilePicked}
              onClear={() => { setReceiptFile(null); setReceiptPreview(null); }}
            />
            {receiptFile && (
              <Button className="w-full" onClick={runOCR} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {aiLoading ? "Lendo nota..." : "Ler nota com IA"}
              </Button>
            )}
            {aiConfidence != null && (
              <div className="text-[11px] text-muted-foreground text-center">
                Confiança da IA: <span className="font-medium">{Math.round(aiConfidence * 100)}%</span>
                {aiConfidence < 0.7 && <Badge variant="outline" className="ml-2 text-[10px]">Revise com atenção</Badge>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-0" />
        </Tabs>

        <div className="mt-5 space-y-3">
          <Field label="Veículo *">
            <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v, booking_id: "none" })}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.license_plate ? `. ${v.license_plate}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Reserva vinculada (opcional)">
            <Select value={form.booking_id} onValueChange={(v) => setForm({ ...form, booking_id: v })} disabled={!form.vehicle_id}>
              <SelectTrigger><SelectValue placeholder="Sem reserva" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem reserva (custo geral do carro)</SelectItem>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.booking_number || b.id.slice(0, 6)}. {formatPersonName(b.customer_name)} ({b.pickup_date} → {b.return_date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo *">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor (USD) *">
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data *">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field label="Pagamento">
              <Select value={form.payment_method || "__none"} onValueChange={(v) => setForm({ ...form, payment_method: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none"></SelectItem>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Fornecedor / Estabelecimento">
            <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Ex: AutoZone, Shell, Mike's Garage" />
          </Field>

          <Field label="Descrição">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Troca de óleo + filtro" />
          </Field>

          <Field label="Observações internas">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas para a equipe" />
          </Field>

          <Field label="Comprovante / Nota (opcional)">
            <ReceiptPicker
              receiptFile={receiptFile}
              receiptPreview={receiptPreview}
              onFilePicked={onFilePicked}
              onClear={() => { setReceiptFile(null); setReceiptPreview(null); }}
            />
          </Field>
        </div>

        <div className="mt-6 flex gap-2 justify-end sticky bottom-0 bg-background pt-4 border-t border-border/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {tab === "ai" && (
            <Button variant="outline" onClick={() => save(true)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar como rascunho
            </Button>
          )}
          <Button onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar custo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReceiptPicker({
  receiptFile,
  receiptPreview,
  onFilePicked,
  onClear,
}: {
  receiptFile: File | null;
  receiptPreview: string | null;
  onFilePicked: (f: File | null) => void;
  onClear: () => void;
}) {
  const isPdf = receiptFile?.type === "application/pdf";
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-4 space-y-3">
      {receiptPreview && !isPdf ? (
        <div className="relative">
          <img src={receiptPreview} alt="Comprovante" className="w-full max-h-80 object-contain rounded" />
          <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-7 w-7" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : receiptFile ? (
        <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
          <span className="truncate">{receiptFile.name}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm">Anexe uma foto da nota ou comprovante</p>
          <div className="flex gap-2 mt-2">
            <label>
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFilePicked(e.target.files?.[0] || null)} />
              <Button asChild size="sm" variant="outline"><span><Camera className="h-3.5 w-3.5 mr-1.5" /> Câmera</span></Button>
            </label>
            <label>
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFilePicked(e.target.files?.[0] || null)} />
              <Button asChild size="sm" variant="outline"><span><ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Galeria</span></Button>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
