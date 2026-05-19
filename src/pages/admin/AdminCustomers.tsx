import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, X, FileText, Upload, Camera, Loader2, ExternalLink, Copy, Check, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { PhoneInput } from "@/components/ui/phone-input";

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
  nationality: "", driver_license: "", notes: "",
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

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro && editing) {
        const addr = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", ");
        setEditing(prev => prev ? { ...prev, address: addr } : prev);
      }
    } catch {}
    setCepLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const { data: customersData } = await supabase.from("customers").select("*").order("full_name");
    const { data: bookingsData } = await supabase.from("bookings").select("customer_id");

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
    load();
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    await supabase.from("customers").delete().eq("id", id);
    toast({ title: "Cliente excluído" });
    load();
  };

  const fields = [
    { label: "Nome completo", key: "full_name" },
    { label: "E-mail", key: "email" },
    { label: "Telefone", key: "phone" },
    { label: "Data de Nascimento", key: "date_of_birth", type: "date" },
    { label: "Documento (CPF)", key: "document_number" },
    { label: "Nacionalidade", key: "nationality" },
    { label: "CEP / Zip Code", key: "zip_code" },
    { label: "Rua / Logradouro", key: "address" },
    { label: "Número", key: "house_number" },
    { label: "Complemento", key: "complement" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
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
              <h2 className="text-base font-bold text-foreground">{isNew ? "Novo Cliente" : "Editar Cliente"}</h2>
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
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <input
                  id="cameraInput"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
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
                    {licenseFile ? licenseFile.name : (editing as any).driver_license_file_url ? "Arquivo já anexado ✓" : "Anexar arquivo"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
                {(editing as any).driver_license_file_url && !licenseFile && (
                  <a href={(editing as any).driver_license_file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-1 inline-block">
                    Ver documento atual →
                  </a>
                )}
              </div>

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
                className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Nome</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Contato</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">CPF</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">CNH</th>
                    <th className="px-5 py-3 text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Nacionalidade</th>
                    <th className="px-5 py-3 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Reservas</th>
                    <th className="px-5 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)} className="border-b border-border/10 hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-5 py-3.5 text-foreground font-medium text-[13px]">{c.full_name}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-muted-foreground text-xs">{c.email || "—"}</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{c.phone || ""}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono tabular-nums">{c.document_number || "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.driver_license || "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.nationality || "—"}</td>
                      <td className="px-5 py-3.5 text-center">
                        {c.booking_count ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md border border-primary/15">
                            <FileText size={10} /> {c.booking_count}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
