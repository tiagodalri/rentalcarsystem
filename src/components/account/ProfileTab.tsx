import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  User, Mail, Phone, FileText, MapPin, Calendar, Globe, Upload, Camera,
  Loader2, Lock, BadgeCheck, Clock, AlertCircle, Save,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProfileForm {
  full_name: string;
  phone: string;
  phone: string;
  nationality: string;
  date_of_birth: string;
  zip_code: string;
  address: string;
  house_number: string;
  complement: string;
  document_number: string;
  driver_license: string;
  driver_license_expiry: string;
}

const isHttpUrl = (s: string | null | undefined) => !!s && /^https?:\/\//i.test(s);

const ProfileTab = () => {
  const { customer, rawUser, refreshCustomer } = useAuth() as any;
  const [form, setForm] = useState<ProfileForm>({
    full_name: "", phone: "", nationality: "", date_of_birth: "",
    zip_code: "", address: "", house_number: "", complement: "",
    document_number: "", driver_license: "", driver_license_expiry: "",
  });
  const [initial, setInitial] = useState<ProfileForm | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Hydrate from customer
  useEffect(() => {
    if (!customer) return;
    const init: ProfileForm = {
      full_name: customer.full_name || "",
      phone: customer.phone || "",
      nationality: customer.nationality || "",
      date_of_birth: customer.date_of_birth || "",
      zip_code: customer.zip_code || "",
      address: customer.address || "",
      house_number: customer.house_number || "",
      complement: customer.complement || "",
      document_number: customer.document_number || "",
      driver_license: customer.driver_license || "",
      driver_license_expiry: customer.driver_license_expiry || "",
    };
    setForm(init);
    setInitial(init);
  }, [customer]);

  // Build preview URL for current CNH (signed for private bucket)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = customer?.driver_license_file_url;
      if (!stored) { setLicensePreview(null); return; }
      if (isHttpUrl(stored)) { setLicensePreview(stored); return; }
      // Treat as path in private bucket "customer-documents"
      const { data } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(stored, 60 * 30);
      if (!cancelled) setLicensePreview(data?.signedUrl || null);
    })();
    return () => { cancelled = true; };
  }, [customer?.driver_license_file_url]);

  const update = (key: keyof ProfileForm, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const addr = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", ");
        setForm((p) => ({ ...p, address: addr }));
      }
    } catch {}
    setCepLoading(false);
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    setLicenseFile(file);
  };

  const dirty = useMemo(() => {
    if (!initial) return false;
    if (licenseFile) return true;
    return (Object.keys(form) as (keyof ProfileForm)[]).some((k) => form[k] !== initial[k]);
  }, [form, initial, licenseFile]);

  const cnhStatus = useMemo(() => {
    const hasFile = !!customer?.driver_license_file_url;
    const verified = !!customer?.driver_license_verified_at;
    if (verified) return { label: "CNH verificada", icon: BadgeCheck, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" };
    if (hasFile) return { label: "Aguardando verificação", icon: Clock, color: "text-amber-600 bg-amber-500/10 border-amber-500/30" };
    return { label: "CNH não enviada", icon: AlertCircle, color: "text-muted-foreground bg-muted/40 border-border" };
  }, [customer]);

  const handleSave = async () => {
    if (!rawUser || !customer) return;
    setSaving(true);
    try {
      let licensePath: string | null = null;

      if (licenseFile) {
        const ext = (licenseFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${rawUser.id}/cnh_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("customer-documents")
          .upload(path, licenseFile, { upsert: true, contentType: licenseFile.type });
        if (upErr) throw upErr;
        licensePath = path;
      }

      const updates: Record<string, any> = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        nationality: form.nationality.trim() || null,
        date_of_birth: form.date_of_birth || null,
        zip_code: form.zip_code.trim() || null,
        address: form.address.trim() || null,
        house_number: form.house_number.trim() || null,
        complement: form.complement.trim() || null,
        document_number: form.document_number.trim() || null,
        driver_license: form.driver_license.trim() || null,
        driver_license_expiry: form.driver_license_expiry || null,
      };
      if (licensePath) {
        updates.driver_license_file_url = licensePath;
        updates.driver_license_verified_at = null;
        updates.driver_license_verified_by = null;
      }

      const { error } = await supabase
        .from("customers")
        .update(updates)
        .eq("user_id", rawUser.id);
      if (error) throw error;

      toast({ title: "Perfil atualizado", description: "Seus dados foram salvos com sucesso." });
      setLicenseFile(null);
      await refreshCustomer?.();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = cnhStatus.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* SEÇÃO: DADOS PESSOAIS */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground mb-4 flex items-center gap-2">
            <User size={14} className="text-primary" /> Dados Pessoais
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome completo" icon={User}>
              <input type="text" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputCls} />
            </Field>
            <Field label="E-mail" icon={Mail} locked tooltip="Para alterar o e-mail, contate o suporte.">
              <input type="email" value={customer?.email || ""} disabled className={inputCls + " opacity-60 cursor-not-allowed"} />
            </Field>
            <Field label="Celular / WhatsApp" icon={Phone}>
              <PhoneInput value={form.phone} onChange={(v) => update("phone", v)} inputClassName="h-9 px-2.5 text-sm" />
            </Field>
            <Field label="Documento (CPF / Passport / ID)" icon={FileText}>
              <input
                type="text"
                value={form.document_number}
                onChange={(e) => update("document_number", e.target.value)}
                className={inputCls}
                placeholder="CPF, Passport ou ID/SSN"
              />
            </Field>
            <Field label="Nacionalidade" icon={Globe}>
              <input type="text" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} className={inputCls} placeholder="Brasileira" />
            </Field>
            <Field label="Data de nascimento" icon={Calendar}>
              <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* SEÇÃO: ENDEREÇO */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground mb-4 flex items-center gap-2">
            <MapPin size={14} className="text-primary" /> Endereço
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CEP / Zip code" icon={MapPin}>
              <div className="relative">
                <input
                  type="text"
                  value={form.zip_code}
                  onChange={(e) => { update("zip_code", e.target.value); lookupCep(e.target.value); }}
                  className={inputCls}
                  placeholder="00000-000"
                />
                {cepLoading && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
              </div>
            </Field>
            <Field label="Número" icon={MapPin}>
              <input type="text" value={form.house_number} onChange={(e) => update("house_number", e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Rua / Logradouro" icon={MapPin}>
                <input type="text" value={form.address} onChange={(e) => update("address", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Complemento" icon={MapPin}>
                <input type="text" value={form.complement} onChange={(e) => update("complement", e.target.value)} className={inputCls} placeholder="Apto, bloco, sala..." />
              </Field>
            </div>
          </div>
        </section>

        {/* SEÇÃO: CNH */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground flex items-center gap-2">
              <FileText size={14} className="text-primary" /> Habilitação (CNH)
            </h3>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cnhStatus.color}`}>
              <StatusIcon size={11} />
              {cnhStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Field label="Número da CNH" icon={FileText}>
              <input type="text" value={form.driver_license} onChange={(e) => update("driver_license", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Validade" icon={Calendar}>
              <input type="date" value={form.driver_license_expiry} onChange={(e) => update("driver_license_expiry", e.target.value)} className={inputCls} />
            </Field>
          </div>

          {/* Preview + upload */}
          <div className="space-y-3">
            {(licenseFile || licensePreview) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
                {licenseFile?.type?.startsWith("image/") || (!licenseFile && licensePreview && !licensePreview.endsWith(".pdf")) ? (
                  <img
                    src={licenseFile ? URL.createObjectURL(licenseFile) : licensePreview!}
                    alt="CNH"
                    className="h-16 w-24 object-cover rounded border border-border"
                  />
                ) : (
                  <div className="h-16 w-24 flex items-center justify-center rounded border border-border bg-background">
                    <FileText size={20} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {licenseFile ? licenseFile.name : "Foto atual da CNH"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {licenseFile ? "Pronta para envio ao salvar" : "Reenvie para atualizar"}
                  </p>
                </div>
              </div>
            )}

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="h-9 px-3 rounded-md border border-dashed border-border bg-background text-xs text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5"
              >
                <Camera size={12} /> Câmera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-9 px-3 rounded-md border border-dashed border-border bg-background text-xs text-foreground hover:border-primary/40 transition-all flex items-center gap-1.5"
              >
                <Upload size={12} /> Anexar arquivo
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Imagem ou PDF, máximo 10MB. Reenviar a foto coloca a CNH em "Aguardando verificação".
            </p>
          </div>
        </section>

        {/* SAVE BUTTON */}
        <div className="sticky bottom-3 z-10">
          <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-3 flex items-center justify-between gap-3 shadow-lg">
            <p className="text-xs text-muted-foreground">
              {dirty ? "Há alterações não salvas." : "Tudo certo, nenhuma alteração pendente."}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="h-9 px-4 rounded-md gold-gradient text-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

const inputCls =
  "w-full h-9 px-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all";

const Field = ({
  label, icon: Icon, locked, tooltip, children,
}: { label: string; icon: any; locked?: boolean; tooltip?: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
      <Icon size={10} className="text-primary/50" />
      {label}
      {locked && tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center"><Lock size={9} className="text-muted-foreground/70" /></span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </label>
    {children}
  </div>
);

export default ProfileTab;
