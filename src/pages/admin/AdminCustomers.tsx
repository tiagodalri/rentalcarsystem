import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobileApp } from "@/hooks/useIsMobileApp";
import MobileCustomers from "./mobile/MobileCustomers";
import { useRegisterFab } from "@/hooks/useAdminFab";
import { useConfirm } from "@/components/mobile/ConfirmSheet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, X, FileText, Upload, Camera, Loader2, ExternalLink, Copy, Check, Users, MessageCircle, User, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { PhoneInput } from "@/components/ui/phone-input";
import { CustomerTagsInline } from "@/components/admin/CustomerTagsManager";
import { buildWhatsAppUrl, defaultClientMessage } from "@/lib/whatsapp";
import { useDocumentOcr, type OcrFields } from "@/hooks/useDocumentOcr";
import OcrReviewPanel from "@/components/admin/OcrReviewPanel";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { CustomersSubNav } from "@/components/admin/CustomersSubNav";
import { ensureTuroTagAssigned } from "@/lib/turoTag";
import { uploadCnhAsStaff, getCnhViewUrl } from "@/lib/cnhStorage";
import { clearFormDraft, useFormDraft } from "@/hooks/useFormDraft";

type CustomerSource = "regular" | "turo";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  nationality: string | null;
  driver_license: string | null;
  notes: string | null;
  created_at: string;
  source: CustomerSource;
  turo_guest_id: string | null;
  booking_count?: number;
};

const emptyCustomer = {
  full_name: "", email: "", phone: "", document_number: "",
  nationality: "", driver_license: "", driver_license_expiry: "", notes: "",
  date_of_birth: "", address: "", house_number: "", complement: "", zip_code: "",
  source: "regular" as CustomerSource, turo_guest_id: "",
};

const ADMIN_CUSTOMER_DRAFT_KEY = "admin-customer-new-v2";

export default function AdminCustomers() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobileApp();
  if (isMobile) return <MobileCustomers />;
  return <AdminCustomersDesktop />;
}

function AdminCustomersDesktop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<CustomerSource>("regular");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<Customer> & { date_of_birth?: string; address?: string; house_number?: string; complement?: string; zip_code?: string; driver_license_expiry?: string; driver_license_file_url?: string }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const openNewCustomer = (source: CustomerSource = segment) => {
    setEditing({ ...emptyCustomer, source });
    setIsNew(true);
  };
  useRegisterFab({ icon: Plus, label: "Adicionar cliente", onClick: () => openNewCustomer() }, [segment]);
  const confirm = useConfirm();
  const [cepLoading, setCepLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { loading: ocrLoading, result: ocrResult, runOcr, reset: resetOcr } = useDocumentOcr();

  useFormDraft(
    ADMIN_CUSTOMER_DRAFT_KEY,
    (editing ?? emptyCustomer) as typeof emptyCustomer,
    (draft) => {
      if (!isNew) return;
      setEditing((prev) => ({ ...(prev ?? emptyCustomer), ...draft }));
    },
    Boolean(isNew && editing),
    {
      debounceMs: 120,
      isEmpty: (draft) => Object.entries(draft)
        .filter(([key]) => key !== "source")
        .every(([, value]) => !String(value ?? "").trim()),
    },
  );

  const onLicenseFile = async (file: File | null) => {
    setLicenseFile(file);
    resetOcr();
    if (file && file.type.startsWith("image/")) {
      await runOcr(file);
    }
  };

  const applyOcr = (values: Partial<Record<keyof OcrFields, string>>) => {
    if (!editing) return;
    setEditing((prev) => prev ? { ...prev, ...values } as any : prev);
    resetOcr();
    toast({ title: "Dados aplicados", description: "Confira e clique em salvar." });
  };

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    setCepLoading(true);
    try {
      // Brasil — CEP 8 dígitos (ViaCEP)
      if (clean.length === 8) {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro && editing) {
          const addr = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", ");
          setEditing(prev => prev ? { ...prev, address: addr } : prev);
        }
      }
      // EUA — ZIP 5 dígitos (Zippopotam)
      else if (clean.length === 5) {
        const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
        if (res.ok) {
          const data = await res.json();
          const place = data.places?.[0];
          if (place && editing) {
            const addr = [place["place name"], place["state abbreviation"], data["country abbreviation"] || "US"]
              .filter(Boolean).join(", ");
            setEditing(prev => prev ? { ...prev, address: addr } : prev);
          }
        }
      }
    } catch {}
    setCepLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, document_number, nationality, date_of_birth, address, house_number, complement, zip_code, driver_license, driver_license_expiry, driver_license_file_url, driver_license_verified_at, created_at, user_id, notes, source, turo_guest_id")
      .is("deleted_at", null)
      .order("full_name");
    const { data: bookingsData } = await supabase.from("bookings").select("customer_id").is("deleted_at", null);

    const countMap: Record<string, number> = {};
    (bookingsData || []).forEach((b: any) => {
      if (b.customer_id) countMap[b.customer_id] = (countMap[b.customer_id] || 0) + 1;
    });

    setCustomers((customersData || []).map((c: any) => ({ ...c, booking_count: countMap[c.id] || 0 })) as Customer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    openNewCustomer(segment);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("new");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const counts = {
    regular: customers.filter((c) => c.source !== "turo").length,
    turo: customers.filter((c) => c.source === "turo").length,
  };

  const filtered = customers
    .filter((c) => (segment === "turo" ? c.source === "turo" : c.source !== "turo"))
    .filter((c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.turo_guest_id || "").includes(search)
    );

  const save = async () => {
    if (!editing) return;
    const isTuro = editing.source === "turo";

    if (isTuro) {
      if (!editing.full_name?.trim()) return toast({ title: "Primeiro nome obrigatório", variant: "destructive" });
    } else {
      if (!editing.full_name?.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    }

    let driverLicenseFileUrl = (editing as any).driver_license_file_url || null;

    // Upload file if new one selected (apenas regular) → private customer-licenses bucket.
    if (!isTuro && licenseFile) {
      const path = await uploadCnhAsStaff(
        licenseFile,
        (editing as any).user_id ?? null,
        editing.id || "new",
      );
      if (path) driverLicenseFileUrl = path;
    }

    const payload: any = isTuro
      ? {
          full_name: editing.full_name!.trim(),
          source: "turo",
          turo_guest_id: (editing.turo_guest_id || "").trim() || null,
          notes: editing.notes || null,
        }
      : {
          full_name: editing.full_name,
          email: editing.email || null,
          phone: editing.phone || null,
          document_number: editing.document_number || null,
          nationality: editing.nationality || null,
          driver_license: editing.driver_license || null,
          driver_license_expiry: (editing as any).driver_license_expiry || null,
          notes: editing.notes || null,
          date_of_birth: (editing as any).date_of_birth || null,
          address: (editing as any).address || null,
          house_number: (editing as any).house_number || null,
          complement: (editing as any).complement || null,
          zip_code: (editing as any).zip_code || null,
          driver_license_file_url: driverLicenseFileUrl,
          source: "regular",
        };

    let customerId = editing.id;
    if (isNew) {
      const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
      if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      customerId = data?.id;
      toast({ title: isTuro ? "Cliente Turo adicionado" : "Cliente adicionado" });
    } else {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing.id!);
      if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      toast({ title: "Cliente atualizado" });
    }

    if (isTuro && customerId) {
      await ensureTuroTagAssigned(customerId);
    }

    if (isNew) clearFormDraft(ADMIN_CUSTOMER_DRAFT_KEY);
    setEditing(null);
    setLicenseFile(null);
    resetOcr();
    load();
  };

  const deleteCustomer = async (id: string) => {
    const ok = await confirm({
      title: "Excluir este cliente?",
      description: "Ele será movido para a lixeira e poderá ser restaurado por um administrador.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("customers").update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null }).eq("id", id);
    toast({ title: "Cliente excluído", description: "Movido para a lixeira." });
    load();
  };

  const fields = [
    { label: "Nome completo", key: "full_name" },
    { label: "E-mail", key: "email" },
    { label: "Número da CNH / Driver License", key: "driver_license" },
    { label: "Validade da CNH", key: "driver_license_expiry", type: "date" },
    { label: "Telefone", key: "phone" },
    { label: "Data de Nascimento", key: "date_of_birth", type: "date" },
    { label: "Documento (CPF/Passport/ID)", key: "document_number" },
    { label: "Nacionalidade", key: "nationality" },
    { label: "CEP ou ZIPCode", key: "zip_code" },
    { label: "Rua / Logradouro", key: "address" },
    { label: "Número", key: "house_number" },
    { label: "Complemento", key: "complement" },
  ];

  return (
    <div className="space-y-6">
      <CustomersSubNav />
      <div className="flex items-center justify-between">

        <div className="hidden lg:block">
          <h1 className="admin-h1">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {segment === "turo"
              ? `${counts.turo} hóspedes Turo`
              : `${counts.regular} clientes cadastrados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              onClick={() => window.open("/cadastro", "_blank")}
              className="border border-border/40 bg-card text-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:bg-muted/50 transition-colors"
            >
              <FileText size={12} /> Formulário de Cadastro
              <ExternalLink size={11} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/cadastro`;
                navigator.clipboard.writeText(url);
                toast({ title: "Link copiado!", description: url });
              }}
              className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-muted border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
              title="Copiar link"
            >
              <Copy size={10} />
            </button>
          </div>
          <button
            onClick={() => openNewCustomer(segment)}
            className="gold-gradient text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
      </div>

      {/* Segmento Regular / Turo */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/30 w-fit">
        {([
          { id: "regular" as const, label: "Regulares", icon: User, count: counts.regular },
          { id: "turo" as const, label: "Turo", icon: Car, count: counts.turo },
        ]).map((t) => {
          const Icon = t.icon;
          const active = segment === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSegment(t.id)}
              className={`h-8 px-3 rounded-lg text-[11.5px] font-medium inline-flex items-center gap-1.5 transition-all ${
                active
                  ? "bg-background text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              {t.label}
              <span className={`ml-0.5 text-[10px] tabular-nums ${active ? "text-primary" : "text-muted-foreground/60"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={segment === "turo" ? "Buscar por nome ou Guest #..." : "Buscar cliente..."}
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/40 bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
        />
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl border border-border/40 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
              <h2 className="admin-h2">{isNew ? "Novo Cliente" : "Editar Cliente"}</h2>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            {isNew && (
              <div className="px-6 py-2 border-b border-border/20 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Rascunho salvo automaticamente
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* Tipo de cliente */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Tipo de cliente
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "regular" as const, label: "Sua Marca (regular)", icon: User, desc: "Cliente direto Sua Marca" },
                    { id: "turo" as const, label: "Turo", icon: Car, desc: "Hóspede importado" },
                  ]).map((opt) => {
                    const Icon = opt.icon;
                    const active = (editing.source || "regular") === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditing({ ...editing, source: opt.id })}
                        className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                          active
                            ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/20"
                            : "border-border/40 bg-background hover:border-border"
                        }`}
                      >
                        <Icon size={15} className={active ? "text-primary mt-0.5" : "text-muted-foreground mt-0.5"} />
                        <div className="min-w-0">
                          <div className={`text-[12px] font-semibold ${active ? "text-foreground" : "text-foreground"}`}>{opt.label}</div>
                          <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {editing.source === "turo" ? (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Primeiro nome *
                    </label>
                    <input
                      type="text"
                      value={editing.full_name ?? ""}
                      onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                      placeholder="Ex.: John"
                      className="w-full h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Guest # da Turo
                    </label>
                    <input
                      type="text"
                      value={editing.turo_guest_id ?? ""}
                      onChange={(e) => setEditing({ ...editing, turo_guest_id: e.target.value })}
                      placeholder="Ex.: 57589798"
                      className="w-full h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-foreground font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                    />
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Identificador do hóspede na Turo. Usado para evitar duplicação.
                    </p>
                  </div>
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/[0.04] p-3 text-[11px] text-muted-foreground">
                    Hóspede importado da Turo — sem dados de contato direto. A tag <span className="font-semibold text-purple-500">Turo</span> será aplicada automaticamente.
                  </div>
                </>
              ) : (
                <>
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{field.label}</label>
                      <div className="relative">
                        {field.key === "phone" ? (
                          <PhoneInput
                            value={(editing as any)[field.key] ?? ""}
                            onChange={(val) => setEditing({ ...editing, [field.key]: val })}
                            inputClassName="h-9 px-3 text-sm"
                          />
                        ) : (
                          <input
                            type={(field as any).type || "text"}
                            value={(editing as any)[field.key] ?? ""}
                            onChange={(e) => {
                              setEditing({ ...editing, [field.key]: e.target.value });
                              if (field.key === "zip_code") lookupCep(e.target.value);
                            }}
                            className="w-full h-9 px-3 rounded-lg border border-border/40 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                          />
                        )}
                        {field.key === "zip_code" && cepLoading && (
                          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* License file upload */}
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Habilitação (CNH) — Foto ou PDF
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => onLicenseFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <input
                      id="cameraInput"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => onLicenseFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <label
                        htmlFor="cameraInput"
                        className="h-9 px-3 rounded-lg border border-dashed border-border/50 bg-background/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Camera size={13} />
                        Câmera
                      </label>
                      <label className="flex-1 h-9 px-3 rounded-lg border border-dashed border-border/50 bg-background/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-2 cursor-pointer">
                        <Upload size={13} />
                        {licenseFile ? licenseFile.name : (editing as any).driver_license_file_url ? "Arquivo já anexado" : "Anexar arquivo"}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => onLicenseFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {ocrLoading && (
                      <p className="text-[11px] text-primary mt-2 flex items-center gap-1.5">
                        <Loader2 size={11} className="animate-spin" /> Lendo documento com IA...
                      </p>
                    )}
                    {(editing as any).driver_license_file_url && !licenseFile && (
                      <button
                        type="button"
                        onClick={async () => {
                          const url = await getCnhViewUrl((editing as any).driver_license_file_url);
                          if (url) window.open(url, "_blank", "noopener,noreferrer");
                          else toast({ title: "Não foi possível abrir o documento", variant: "destructive" });
                        }}
                        className="text-[10px] text-primary hover:underline mt-1 inline-block"
                      >
                        Ver documento atual →
                      </button>
                    )}
                  </div>

                  {ocrResult && (
                    <OcrReviewPanel
                      extracted={ocrResult}
                      current={{
                        full_name: (editing as any).full_name,
                        document_number: (editing as any).document_number,
                        driver_license: (editing as any).driver_license,
                        driver_license_expiry: (editing as any).driver_license_expiry,
                        date_of_birth: (editing as any).date_of_birth,
                      }}
                      onApply={applyOcr}
                      onDismiss={resetOcr}
                    />
                  )}
                </>
              )}

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Observações</label>
                <textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/20">
              <button
                onClick={save}
                className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-[11px] font-medium uppercase tracking-[0.16em] hover:opacity-90 transition-opacity"
              >
                {isNew ? "Adicionar Cliente" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="bg-card/80 border-border/30 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} columns={[
              { width: "w-28" }, { width: "w-36" }, { width: "w-20" },
              { width: "w-16" }, { width: "w-20" }, { width: "w-10", align: "center" }, { width: "w-8" },
            ]} />
          ) : filtered.length === 0 && customers.length > 0 ? (
            <EmptyState icon={Search} title="Nenhum cliente encontrado" description="Nenhum cliente corresponde à busca atual." actionLabel="Limpar busca" onAction={() => setSearch("")} compact />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title={segment === "turo" ? "Nenhum cliente Turo" : "Nenhum cliente cadastrado"} description={segment === "turo" ? "Hóspedes importados da Turo aparecerão aqui." : "Os clientes aparecerão aqui após se cadastrarem ou serem adicionados manualmente."} actionLabel="Adicionar Cliente" onAction={() => openNewCustomer(segment)} compact />
          ) : segment === "turo" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cliente Turo</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Guest #</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Tags</th>
                    <th className="px-4 py-3 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reservas</th>
                    <th className="px-3 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const displayName = formatPersonName(c.full_name);
                    return (
                      <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="border-b border-border/10 hover:bg-muted/20 transition-colors group cursor-pointer">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <PersonAvatar name={c.full_name} size="sm" />
                            <span className="text-foreground font-medium text-[13px] truncate max-w-[260px]">{displayName}</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-purple-500/15 text-purple-500 border border-purple-500/30">
                              <Car size={9} /> Turo
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs font-mono tabular-nums">
                          {c.turo_guest_id || <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <CustomerTagsInline customerId={c.id} />
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {c.booking_count ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md border border-primary/15 tabular-nums">
                              <FileText size={10} /> {c.booking_count}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/30 tabular-nums">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditing(c); setIsNew(false); }} className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => deleteCustomer(c.id)} className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Cliente</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">E-mail</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Telefone</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Documento</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">CNH</th>
                    <th className="px-4 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Tags</th>
                    <th className="px-4 py-3 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">Reservas</th>
                    <th className="px-3 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const wa = buildWhatsAppUrl(c.phone, defaultClientMessage(c.full_name));
                    const displayName = formatPersonName(c.full_name);
                    return (
                    <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="border-b border-border/10 hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <PersonAvatar name={c.full_name} size="sm" />
                          <span className="text-foreground font-medium text-[13px] truncate max-w-[200px]">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs truncate max-w-[220px]">
                        {c.email || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {c.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-mono tabular-nums">{c.phone}</span>
                            {wa && (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] transition-colors shadow-sm"
                                title="Enviar WhatsApp"
                                aria-label="Enviar WhatsApp"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs font-mono tabular-nums">
                        {c.document_number || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs font-mono tabular-nums">
                        {c.driver_license || <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <CustomerTagsInline customerId={c.id} />
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        {c.booking_count ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md border border-primary/15 tabular-nums">
                            <FileText size={10} /> {c.booking_count}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30 tabular-nums">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditing(c); setIsNew(false); }}
                            className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteCustomer(c.id)}
                            className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

          )}
        </CardContent>
      </Card>
    </div>
  );
}
