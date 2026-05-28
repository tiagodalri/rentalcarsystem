import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLANS, PLAN_ORDER } from "@/data/rentalPlans";
import { Loader2, Upload, Sparkles, ImageIcon, CalendarIcon } from "lucide-react";
import { CustomerCombobox, type CustomerLite } from "@/components/admin/CustomerCombobox";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";

function DateField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:border-primary/40 transition-colors",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span>{selected ? format(selected, "dd/MM/yyyy") : "dd/mm/aaaa"}</span>
          <CalendarIcon className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border z-[60]" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          defaultMonth={selected ?? new Date()}
          captionLayout="dropdown-buttons"
          fromYear={2020}
          toYear={2035}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

const DRAFT_KEY = "new-booking";

const PENDING_CLASS = "ring-1 ring-amber-500/60 focus-visible:ring-amber-500";

type Vehicle = { id: string; name: string; daily_price_usd: number; default_deposit_amount?: number | null; default_franchise_amount?: number | null };

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
  "Stripe",
  "PayPal",
  "PIX",
  "Dinheiro",
  "Transferência Bancária",
  "Zelle",
  "Outro",
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "BRL", label: "BRL (R$)" },
];

export function NewBookingDialog({ open, onOpenChange, onCreated }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [extractedOnce, setExtractedOnce] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const isAcceptedFile = (f: File) =>
    f.type.startsWith("image/") || f.type === "application/pdf";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (extracting) return;
    const file = Array.from(e.dataTransfer.files || []).find(isAcceptedFile);
    if (file) {
      handleExtract(file);
    } else if (e.dataTransfer.files?.length) {
      toast({ title: "Formato não suportado", description: "Envie uma imagem ou PDF.", variant: "destructive" });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (extracting) return;
    const file = Array.from(e.clipboardData?.files || []).find(isAcceptedFile);
    if (file) {
      e.preventDefault();
      handleExtract(file);
    }
  };

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
    currency: "USD",
    payment_method: "Cartão de Crédito",
    contract_url: "",
    status: "confirmed",
    notes: "",
    deposit_amount: "",
    deposit_refund_days: "30",
    franchise_amount: "",
  });

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (pendingFields.has(k as string)) {
      setPendingFields((prev) => {
        const next = new Set(prev);
        next.delete(k as string);
        return next;
      });
    }
  };

  const pendingClass = (k: string) => (pendingFields.has(k) ? PENDING_CLASS : "");

  // Auto-save de rascunho (restaura ao abrir, salva enquanto preenche)
  useFormDraft(DRAFT_KEY, form, setForm, open);

  const matchVehicleByName = (name?: string | null): string => {
    if (!name) return "";
    const n = name.toLowerCase().trim();
    // exact then partial
    const exact = vehicles.find((v) => v.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = vehicles.find(
      (v) => v.name.toLowerCase().includes(n) || n.includes(v.name.toLowerCase()),
    );
    return partial?.id || "";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        resolve(result.split(",")[1] || "");
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleExtract = async (file?: File) => {
    if (!file && !extractText.trim()) {
      toast({ title: "Envie uma imagem ou cole o texto", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const body: any = {};
      if (file) {
        body.imageBase64 = await fileToBase64(file);
        body.mimeType = file.type || "image/png";
      }
      if (extractText.trim()) body.text = extractText.trim();

      const { data, error } = await supabase.functions.invoke("extract-booking", { body });
      if (error) throw error;
      const d = data?.data || {};

      const newForm = { ...form };
      const pending = new Set<string>();
      const apply = (k: keyof typeof form, v: any) => {
        if (v !== null && v !== undefined && v !== "") {
          newForm[k] = String(v);
        } else {
          pending.add(k as string);
        }
      };

      apply("customer_name", d.customer_name);
      apply("customer_email", d.customer_email);
      apply("customer_phone", d.customer_phone);
      apply("pickup_date", d.pickup_date);
      apply("return_date", d.return_date);
      if (d.pickup_time) newForm.pickup_time = d.pickup_time;
      if (d.return_time) newForm.return_time = d.return_time;
      apply("pickup_location", d.pickup_location);
      apply("return_location", d.return_location);
      if (d.total_price != null) newForm.total_price = String(d.total_price);
      else pending.add("total_price");
      if (d.currency === "BRL" || d.currency === "USD") newForm.currency = d.currency;
      if (d.payment_method) newForm.payment_method = d.payment_method;
      if (d.deposit_amount != null) newForm.deposit_amount = String(d.deposit_amount);
      if (d.franchise_amount != null) newForm.franchise_amount = String(d.franchise_amount);
      if (d.notes) newForm.notes = d.notes;

      const vid = matchVehicleByName(d.vehicle_name);
      if (vid) newForm.vehicle_id = vid;
      else pending.add("vehicle_id");

      setForm(newForm);
      setPendingFields(pending);
      setExtractedOnce(true);
      const missing = Array.from(pending).length;
      toast({
        title: "Dados extraídos",
        description: missing
          ? `${missing} campo(s) ficaram pendentes — preencha em destaque amarelo.`
          : "Todos os campos foram preenchidos. Revise antes de salvar.",
      });
    } catch (e: any) {
      toast({
        title: "Erro ao extrair",
        description: e.message || "Falha na IA",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    supabase
      .from("vehicles")
      .select("id, name, daily_price_usd, default_deposit_amount, default_franchise_amount")
      .eq("published", true)
      .order("name")
      .then(({ data }) => setVehicles((data as Vehicle[]) || []));
  }, [open]);

  // Auto-suggest total price + deposit/franchise defaults when vehicle/dates change
  useEffect(() => {
    if (!form.vehicle_id) return;
    const veh = vehicles.find((v) => v.id === form.vehicle_id);
    if (!veh) return;

    // Pré-preencher caução e franquia com os defaults do veículo
    if (!form.deposit_amount && veh.default_deposit_amount != null) {
      set("deposit_amount", String(veh.default_deposit_amount));
    }
    if (!form.franchise_amount && veh.default_franchise_amount != null) {
      set("franchise_amount", String(veh.default_franchise_amount));
    }

    if (!form.pickup_date || !form.return_date) return;
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
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : 0,
      deposit_refund_days: form.deposit_refund_days ? Number(form.deposit_refund_days) : null,
      franchise_amount: form.franchise_amount ? Number(form.franchise_amount) : 0,
      addons: {
        payment_method: form.payment_method,
        currency: form.currency,
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
    clearFormDraft(DRAFT_KEY);
    onCreated();
    onOpenChange(false);
    setCustomer(null);
    setForm({
      customer_name: "", customer_email: "", customer_phone: "",
      vehicle_id: "", pickup_date: "", pickup_time: "10:00",
      return_date: "", return_time: "10:00",
      pickup_location: "", return_location: "",
      plan_id: "conforto", total_price: "", currency: "USD",
      payment_method: "Cartão de Crédito", contract_url: "",
      status: "confirmed", notes: "",
      deposit_amount: "", deposit_refund_days: "30", franchise_amount: "",
    });
    setPendingFields(new Set());
    setExtractText("");
    setExtractedOnce(false);
  };

  // --- UI helpers (mobile-first) ----------------------------------------------
  const inputCls = "h-11 text-[15px]";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1.5 block";
  const triggerCls = "h-11 text-[15px]";

  type SectionProps = { step: number; title: string; children: React.ReactNode };
  const Section = ({ step, title, children }: SectionProps) => (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-4 sm:p-5">
      <header className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold tabular-nums">
          {step}
        </span>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] sm:w-full max-w-3xl p-0 gap-0 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-2xl"
      >
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="text-base sm:text-lg">Nova reserva manual</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Preencha em 7 etapas. Use a IA para extrair de prints e PDFs.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
          {/* IA - Extração inteligente */}
          <section
            className={`rounded-2xl border-2 border-dashed p-4 sm:p-5 transition-colors ${
              dragOver
                ? "border-primary bg-primary/10"
                : "border-primary/30 bg-primary/5"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!extracting) setDragOver(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!extracting) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <Sparkles size={18} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Extrair dados com IA</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {dragOver
                    ? "Solte o arquivo aqui para extrair os dados..."
                    : "Arraste um print/PDF, cole (Ctrl+V) ou use os botões. Campos pendentes ficam destacados em amarelo."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex items-center justify-center gap-2 cursor-pointer h-11 px-3 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
                {extracting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {extracting ? "Analisando..." : "Enviar print/PDF"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={extracting}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExtract(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleExtract()}
                disabled={extracting || !extractText.trim()}
                className="h-11 rounded-xl"
              >
                {extracting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
                Extrair do texto
              </Button>
            </div>
            <Textarea
              rows={2}
              className="mt-2.5 text-sm"
              placeholder="Ou cole aqui o texto da mensagem do WhatsApp..."
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
            />
            {extractedOnce && pendingFields.size > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 leading-relaxed">
                {pendingFields.size} campo(s) pendente(s) destacado(s) em amarelo.
              </p>
            )}
          </section>

          {/* 1. Cliente */}
          <Section step={1} title="Cliente">
            <div className="mb-3">
              <Label className={labelCls}>Buscar cliente existente</Label>
              <CustomerCombobox selected={customer} onSelect={handleSelectCustomer} />
            </div>
            <div className="space-y-3">
              <div>
                <Label className={labelCls}>Nome completo *</Label>
                <Input
                  className={`${inputCls} ${pendingClass("customer_name")}`}
                  value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)}
                  placeholder="João da Silva"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label className={labelCls}>E-mail</Label>
                  <Input
                    className={`${inputCls} ${pendingClass("customer_email")}`}
                    type="email"
                    inputMode="email"
                    value={form.customer_email}
                    onChange={(e) => set("customer_email", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="min-w-0">
                  <Label className={labelCls}>Telefone</Label>
                  <Input
                    className={`${inputCls} ${pendingClass("customer_phone")}`}
                    type="tel"
                    inputMode="tel"
                    value={form.customer_phone}
                    onChange={(e) => set("customer_phone", e.target.value)}
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* 2. Veículo & Plano */}
          <Section step={2} title="Veículo e plano">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label className={labelCls}>Veículo *</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v)}>
                  <SelectTrigger className={`${triggerCls} ${pendingClass("vehicle_id")}`}>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} — ${Number(v.daily_price_usd).toFixed(0)}/dia
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className={labelCls}>Plano</Label>
                <Select value={form.plan_id} onValueChange={(v) => set("plan_id", v)}>
                  <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
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
          </Section>

          {/* 3. Período */}
          <Section step={3} title="Período">
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Retirada</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="min-w-0">
                    <Label className={labelCls}>Data *</Label>
                    <DateField className={pendingClass("pickup_date")} value={form.pickup_date} onChange={(v) => set("pickup_date", v)} />
                  </div>
                  <div className="min-w-0">
                    <Label className={labelCls}>Hora</Label>
                    <Input className={inputCls} type="time" value={form.pickup_time} onChange={(e) => set("pickup_time", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Devolução</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="min-w-0">
                    <Label className={labelCls}>Data *</Label>
                    <Input className={`${inputCls} ${pendingClass("return_date")}`} type="date" value={form.return_date} onChange={(e) => set("return_date", e.target.value)} />
                  </div>
                  <div className="min-w-0">
                    <Label className={labelCls}>Hora</Label>
                    <Input className={inputCls} type="time" value={form.return_time} onChange={(e) => set("return_time", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label className={labelCls}>Local de retirada</Label>
                  <div className={pendingFields.has("pickup_location") ? "rounded-md " + PENDING_CLASS : ""}>
                    <AddressAutocomplete
                      value={form.pickup_location}
                      onChange={(v) => set("pickup_location", v)}
                      placeholder="Ex: MCO Aeroporto Orlando"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <Label className={labelCls}>Local de devolução</Label>
                  <div className={pendingFields.has("return_location") ? "rounded-md " + PENDING_CLASS : ""}>
                    <AddressAutocomplete
                      value={form.return_location}
                      onChange={(v) => set("return_location", v)}
                      placeholder="Ex: MCO Aeroporto Orlando"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 4. Pagamento */}
          <Section step={4} title="Pagamento">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="min-w-0">
                <Label className={labelCls}>Moeda</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label className={labelCls}>Valor total</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                    {form.currency === "BRL" ? "R$" : "$"}
                  </span>
                  <Input
                    className={`${inputCls} ${pendingClass("total_price")} pl-9 tabular-nums`}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.total_price}
                    onChange={(e) => set("total_price", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 min-w-0">
                <Label className={labelCls}>Forma de pagamento</Label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 sm:col-span-1 min-w-0">
                <Label className={labelCls}>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* 5. Caução & Franquia */}
          <Section step={5} title="Caução e franquia">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label className={labelCls}>Caução</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                      {form.currency === "BRL" ? "R$" : "$"}
                    </span>
                    <Input
                      className={`${inputCls} pl-9 tabular-nums`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.deposit_amount}
                      onChange={(e) => set("deposit_amount", e.target.value)}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <Label className={labelCls}>Franquia em acidente</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                      {form.currency === "BRL" ? "R$" : "$"}
                    </span>
                    <Input
                      className={`${inputCls} pl-9 tabular-nums`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.franchise_amount}
                      onChange={(e) => set("franchise_amount", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className={labelCls}>Prazo de devolução da caução (dias corridos após devolução do veículo)</Label>
                <Input
                  className={`${inputCls} tabular-nums`}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="30"
                  value={form.deposit_refund_days}
                  onChange={(e) => set("deposit_refund_days", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Padrão: 30 dias corridos.</p>
              </div>
            </div>
          </Section>

          {/* 6. Contrato */}
          <Section step={6} title="Contrato">
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center justify-center gap-2 cursor-pointer h-11 px-3 rounded-xl border border-dashed border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
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
                <a
                  href={form.contract_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 px-3 py-2 rounded-lg min-w-0"
                >
                  <ImageIcon size={13} className="shrink-0" />
                  <span className="truncate">Ver contrato anexado</span>
                </a>
              )}
            </div>
          </Section>

          {/* 7. Observações */}
          <Section step={7} title="Observações">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas internas sobre essa reserva..."
              className="text-[15px]"
            />
          </Section>
        </div>

        <DialogFooter
          className="px-4 sm:px-6 py-3 border-t border-border/50 shrink-0 bg-background/95 backdrop-blur-sm flex flex-col-reverse sm:flex-row sm:justify-end gap-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-11 rounded-xl w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-11 rounded-xl w-full sm:w-auto font-semibold"
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Criar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

