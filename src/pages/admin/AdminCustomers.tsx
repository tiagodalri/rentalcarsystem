import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, X, FileText, Upload, Camera, Loader2, ExternalLink, Copy, Check, Users, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { PhoneInput } from "@/components/ui/phone-input";
import { CustomerTagsInline } from "@/components/admin/CustomerTagsManager";
import { buildWhatsAppUrl, defaultClientMessage } from "@/lib/whatsapp";
import { useDocumentOcr, type OcrFields } from "@/hooks/useDocumentOcr";
import OcrReviewPanel from "@/components/admin/OcrReviewPanel";
import { formatPersonName } from "@/lib/formatName";

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
  booking_count?: number;
};

const emptyCustomer = {
  full_name: "", email: "", phone: "", document_number: "",
  nationality: "", driver_license: "", driver_license_expiry: "", notes: "",
  date_of_birth: "", address: "", house_number: "", complement: "", zip_code: "",
};

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { loading: ocrLoading, result: ocrResult, runOcr, reset: resetOcr } = useDocumentOcr();

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
      .select("id, full_name, email, phone, document_number, nationality, date_of_birth, address, house_number, complement, zip_code, driver_license, driver_license_expiry, driver_license_file_url, driver_license_verified_at, created_at, user_id, notes")
      .is("deleted_at", null)
      .order("full_name");
    const { data: bookingsData } = await supabase.from("bookings").select("customer_id").is("deleted_at", null);

    const countMap: Record<string, number> = {};
    (bookingsData || []).forEach((b: any) => {
      if (b.customer_id) countMap[b.customer_id] = (countMap[b.customer_id] || 0) + 1;
    });

    setCustomers((customersData || []).map(c => ({ ...c, booking_count: countMap[c.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const save = async () => {
    if (!editing?.full_name) return toast({ title: "Nome obrigatório", variant: "destructive" });

    let driverLicenseFileUrl = (editing as any).driver_license_file_url || null;

    // Upload file if new one selected
    if (licenseFile) {
      const ext = licenseFile.name.split(".").pop();
      const path = `licenses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("inspections").upload(path, licenseFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("inspections").getPublicUrl(path);
        driverLicenseFileUrl = urlData.publicUrl;
      }
    }

    const payload = {
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
    };

    if (isNew) {
      await supabase.from("customers").insert(payload);
      toast({ title: "Cliente adicionado" });
    } else {
      await supabase.from("customers").update(payload).eq("id", editing.id!);
      toast({ title: "Cliente atualizado" });
    }
    setEditing(null);
    setLicenseFile(null);
    resetOcr();
    load();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Excluir este cliente? (Pode ser restaurado por um administrador)")) return;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="admin-h1">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} clientes cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              onClick={() => window.open("/cadastro", "_blank")}
              className="border border-border/40 bg-card text-foreground px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:bg-muted/50 transition-colors"
            >
              <FileText size={14} /> Formulário de Cadastro
              <ExternalLink size={12} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/cadastro`;
                navigator.clipboard.writeText(url);
                toast({ title: "Link copiado!", description: url });
              }}
              className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-muted border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
              title="Copiar link"
            >
              <Copy size={10} />
            </button>
          </div>
          <button
            onClick={() => { setEditing({ ...emptyCustomer }); setIsNew(true); }}
            className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
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

            <div className="p-6 space-y-4">
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
                  <a href={(editing as any).driver_license_file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-1 inline-block">
                    Ver documento atual →
                  </a>
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
            <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Os clientes aparecerão aqui após se cadastrarem ou serem adicionados manualmente." actionLabel="Adicionar Cliente" onAction={() => { setEditing({ ...emptyCustomer }); setIsNew(true); }} compact />
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
                    const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
                    return (
                    <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="border-b border-border/10 hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {initials || "?"}
                          </div>
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
