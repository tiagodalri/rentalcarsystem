import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Phone, MessageCircle, X, Users, Car, Loader2, User, Mail, FileText, MapPin, Save, type LucideIcon } from "lucide-react";
import { formatPersonName } from "@/lib/formatName";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { CustomersSubNav } from "@/components/admin/CustomersSubNav";
import { useRegisterFab } from "@/hooks/useAdminFab";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "@/hooks/use-toast";
import { clearFormDraft, useFormDraft } from "@/hooks/useFormDraft";

/* ============================================================
   CLIENTES. Mobile-first
   Lista estilo agenda do iPhone: avatares com inicial,
   agrupado por letra, swipe→ligar/whatsapp.
   Segmento Regular (GoDrive) / Turo igual ao desktop.
   ============================================================ */

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: "regular" | "turo" | null;
  turo_guest_id: string | null;
};

type MobileCustomerForm = {
  full_name: string;
  email: string;
  phone: string;
  document_number: string;
  nationality: string;
  driver_license: string;
  driver_license_expiry: string;
  date_of_birth: string;
  zip_code: string;
  address: string;
  house_number: string;
  complement: string;
  notes: string;
  source: "regular" | "turo";
  turo_guest_id: string;
};

const MOBILE_CUSTOMER_DRAFT_KEY = "admin-mobile-customer-new-v2";

const emptyMobileCustomer: MobileCustomerForm = {
  full_name: "",
  email: "",
  phone: "",
  document_number: "",
  nationality: "",
  driver_license: "",
  driver_license_expiry: "",
  date_of_birth: "",
  zip_code: "",
  address: "",
  house_number: "",
  complement: "",
  notes: "",
  source: "regular",
  turo_guest_id: "",
};

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const onlyDigits = (s: string | null) => (s || "").replace(/\D/g, "");

export default function MobileCustomers() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"regular" | "turo">("regular");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MobileCustomerForm>({ ...emptyMobileCustomer });

  const openNewCustomer = (source: "regular" | "turo" = segment) => {
    setForm((prev) => ({ ...prev, source }));
    setShowForm(true);
  };

  useRegisterFab({ icon: Plus, label: "Novo cliente", onClick: () => openNewCustomer() }, [segment]);

  useFormDraft(
    MOBILE_CUSTOMER_DRAFT_KEY,
    form,
    (draft) => setForm((prev) => ({ ...prev, ...draft })),
    showForm,
    {
      debounceMs: 120,
      isEmpty: (draft) => Object.entries(draft)
        .filter(([key]) => key !== "source")
        .every(([, value]) => !String(value ?? "").trim()),
    },
  );

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, source, turo_guest_id")
      .is("deleted_at", null)
      .order("full_name");

    setItems((data as Customer[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

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

  const update = (key: keyof MobileCustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveCustomer = async () => {
    if (!form.full_name.trim()) {
      toast({ title: form.source === "turo" ? "Primeiro nome obrigatório" : "Nome obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    const isTuro = form.source === "turo";
    const payload = isTuro
      ? {
          full_name: form.full_name.trim(),
          source: "turo",
          turo_guest_id: form.turo_guest_id.trim() || null,
          notes: form.notes.trim() || null,
        }
      : {
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          document_number: form.document_number.trim() || null,
          nationality: form.nationality.trim() || null,
          driver_license: form.driver_license.trim() || null,
          driver_license_expiry: form.driver_license_expiry || null,
          date_of_birth: form.date_of_birth || null,
          zip_code: form.zip_code.trim() || null,
          address: form.address.trim() || null,
          house_number: form.house_number.trim() || null,
          complement: form.complement.trim() || null,
          notes: form.notes.trim() || null,
          source: "regular",
        };

    const { error } = await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    clearFormDraft(MOBILE_CUSTOMER_DRAFT_KEY);
    setForm({ ...emptyMobileCustomer, source: segment });
    setShowForm(false);
    toast({ title: isTuro ? "Cliente Turo adicionado" : "Cliente adicionado" });
    void load();
  };

  const counts = useMemo(() => ({
    regular: items.filter((c) => c.source !== "turo").length,
    turo: items.filter((c) => c.source === "turo").length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items
      .filter((c) => (segment === "turo" ? c.source === "turo" : c.source !== "turo"))
      .filter((c) =>
        !q || `${c.full_name} ${c.email || ""} ${c.phone || ""} ${c.turo_guest_id || ""}`.toLowerCase().includes(q),
      );
  }, [items, search, segment]);

  const grouped = useMemo(() => {
    const g: Record<string, Customer[]> = {};
    filtered.forEach((c) => {
      const letter = (c.full_name?.[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      (g[key] ||= []).push(c);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-28">
        <div className="px-3 pt-2">
          <CustomersSubNav />
        </div>
        <div className="px-4">
          {/* Segmento GoDrive (Regular) / Turo */}
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([
              { id: "regular" as const, label: "GoDrive", icon: Users, count: counts.regular },
              { id: "turo" as const, label: "Turo", icon: Car, count: counts.turo },
            ]).map((s) => {
              const Icon = s.icon;
              const active = segment === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSegment(s.id)}
                  className={`h-10 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border/50"
                  }`}
                >
                  <Icon size={14} />
                  <span>{s.label}</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${active ? "opacity-90" : "text-muted-foreground"}`}>
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {segment === "turo" ? `${filtered.length} hóspedes Turo` : `${filtered.length} cadastrados`}
          </p>

          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={segment === "turo" ? "Buscar por nome ou Guest #..." : "Buscar cliente"}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="px-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-card border border-border/40 flex items-center px-4 gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                    <div className="h-2 w-1/3 rounded bg-muted/60 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

          ) : grouped.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum cliente.</div>
          ) : grouped.map(([letter, list]) => (
            <div key={letter} className="mb-2">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground bg-muted/40 sticky top-0 backdrop-blur z-10">
                {letter}
              </div>
              {list.map((c) => {
                const isTuro = c.source === "turo";
                return (
                  <div key={c.id} className="flex items-center px-4 py-3 border-b border-border/30 bg-card">
                    <button
                      onClick={() => navigate(`/admin/customers/${c.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      {isTuro ? (
                        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-purple-500/15 text-purple-600 shrink-0">
                          <Car size={16} />
                        </div>
                      ) : (
                        <PersonAvatar name={c.full_name} size="md" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="text-sm font-medium truncate">{formatPersonName(c.full_name)}</div>
                          {isTuro && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-purple-500/12 text-purple-600 text-[9px] font-semibold uppercase tracking-wider">
                              <Car size={8} /> Turo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {isTuro
                            ? (c.turo_guest_id ? `Guest #${c.turo_guest_id}` : "Hóspede Turo")
                            : (c.phone || c.email || "")}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isTuro && c.phone && (
                        <>
                          <a href={`tel:${onlyDigits(c.phone)}`} className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center active:bg-emerald-500/20">
                            <Phone size={15} />
                          </a>
                          <a href={`https://wa.me/${onlyDigits(c.phone)}`} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-[#25D366]/15 text-[#1ea152] flex items-center justify-center active:bg-[#25D366]/25">
                            <MessageCircle size={15} />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end" onClick={() => setShowForm(false)}>
            <div
              className="w-full max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-border/50 bg-background pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Rascunho salvo automaticamente</p>
                    <h2 className="text-base font-semibold text-foreground">Novo cliente</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    aria-label="Fechar cadastro"
                    className="h-11 w-11 rounded-full border border-border/50 bg-card flex items-center justify-center text-muted-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="px-4 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "regular" as const, label: "GoDrive", icon: Users },
                    { id: "turo" as const, label: "Turo", icon: Car },
                  ]).map((option) => {
                    const Icon = option.icon;
                    const active = form.source === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => update("source", option.id)}
                        className={`h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border/50 bg-card text-foreground"
                        }`}
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <MobileField label={form.source === "turo" ? "Primeiro nome" : "Nome completo"} icon={User}>
                  <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={mobileInputClass} autoComplete="name" />
                </MobileField>

                {form.source === "turo" ? (
                  <MobileField label="Guest # da Turo" icon={Car}>
                    <input value={form.turo_guest_id} onChange={(e) => update("turo_guest_id", e.target.value)} className={`${mobileInputClass} font-mono tabular-nums`} />
                  </MobileField>
                ) : (
                  <>
                    <MobileField label="E-mail" icon={Mail}>
                      <input type="email" inputMode="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={mobileInputClass} autoComplete="email" />
                    </MobileField>
                    <MobileField label="Telefone / WhatsApp" icon={Phone}>
                      <PhoneInput value={form.phone} onChange={(value) => update("phone", value)} inputClassName="h-11 px-3 text-base rounded-xl" />
                    </MobileField>
                    <div className="grid grid-cols-1 gap-4">
                      <MobileField label="Documento" icon={FileText}>
                        <input value={form.document_number} onChange={(e) => update("document_number", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                      <MobileField label="CNH / Driver License" icon={FileText}>
                        <input value={form.driver_license} onChange={(e) => update("driver_license", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                      <MobileField label="Validade da CNH" icon={FileText}>
                        <input type="date" value={form.driver_license_expiry} onChange={(e) => update("driver_license_expiry", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                      <MobileField label="Data de nascimento" icon={FileText}>
                        <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                      <MobileField label="Nacionalidade" icon={FileText}>
                        <input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                    </div>
                    <MobileField label="CEP / Zip" icon={MapPin}>
                      <input value={form.zip_code} onChange={(e) => update("zip_code", e.target.value)} className={mobileInputClass} inputMode="numeric" />
                    </MobileField>
                    <MobileField label="Endereço" icon={MapPin}>
                      <input value={form.address} onChange={(e) => update("address", e.target.value)} className={mobileInputClass} />
                    </MobileField>
                    <div className="grid grid-cols-2 gap-3">
                      <MobileField label="Número" icon={MapPin}>
                        <input value={form.house_number} onChange={(e) => update("house_number", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                      <MobileField label="Complemento" icon={MapPin}>
                        <input value={form.complement} onChange={(e) => update("complement", e.target.value)} className={mobileInputClass} />
                      </MobileField>
                    </div>
                  </>
                )}

                <MobileField label="Observações" icon={FileText}>
                  <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} className={`${mobileInputClass} h-auto py-3 resize-none`} />
                </MobileField>

                <button
                  type="button"
                  onClick={saveCustomer}
                  disabled={saving}
                  className="h-12 w-full rounded-xl bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Salvar cliente
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PullToRefresh>
  );
}

const mobileInputClass = "w-full min-h-11 rounded-xl border border-border/50 bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25";

function MobileField({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5">
        <Icon size={12} className="text-primary" />
        {label}
      </span>
      {children}
    </label>
  );
}
