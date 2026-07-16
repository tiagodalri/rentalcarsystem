import { useState, useRef, useMemo } from "react";
import {
  User, Mail, Phone, Calendar as CalendarIcon, Globe, FileText, MapPin,
  Upload, Camera, Loader2, Building2, AlertCircle, CheckCircle2,
  ShieldCheck, ChevronDown, Lock,
} from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidEmail, suggestEmail } from "@/lib/formValidators";
import { BirthDatePicker } from "./BirthDatePicker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, parse, isValid } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type AddressCountry = "BR" | "US" | "OTHER";

export interface CustomerData {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;       // ISO yyyy-MM-dd
  nationality: string;
  document_number: string;
  document_type?: "cpf" | "passport" | "id";
  address: string;
  house_number: string;
  complement: string;
  zip_code: string;
  district: string;
  city: string;
  state: string;
  country?: AddressCountry;
  licenseFile: File | null;
}

interface Props {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
}

const NATIONALITIES = ["Brasileira", "Americana", "Portuguesa", "Outra"] as const;

const FIELD_BASE =
  "w-full h-14 px-4 rounded-xl border bg-background text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all";
const FIELD_OK = "border-border/60 focus:ring-primary/25 focus:border-primary/50";
const FIELD_ERR = "border-destructive/60 focus:ring-destructive/25 focus:border-destructive/60";

function SectionCard({
  icon: Icon, title, subtitle, children, status,
}: {
  icon: any; title: string; subtitle?: string; children: React.ReactNode;
  status?: "default" | "complete" | "warning";
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <header className="flex items-start gap-3 p-5 sm:p-6 pb-4 border-b border-border/40">
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          status === "complete" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
        )}>
          {status === "complete" ? <CheckCircle2 size={18} /> : <Icon size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </header>
      <div className="p-5 sm:p-6 space-y-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-muted-foreground mb-2 block">
      {children}
    </label>
  );
}

export default function CustomerDataStep({ data, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [otherNationality, setOtherNationality] = useState(
    data.nationality && !NATIONALITIES.includes(data.nationality as any)
  );
  const [addressOpen, setAddressOpen] = useState(false);

  const emailSuggestion = suggestEmail(data.email || "");
  const emailValid = isValidEmail(data.email || "");
  const showEmailError = emailTouched && (data.email || "").length > 0 && !emailValid;
  const nameParts = (data.full_name || "").trim().split(/\s+/).filter(p => p.length >= 2);
  const nameValid = nameParts.length >= 2;
  const showNameError = nameTouched && (data.full_name || "").trim().length > 0 && !nameValid;

  const documentType = data.document_type || "cpf";

  const update = (key: keyof CustomerData, value: any) => {
    onChange({ ...data, [key]: value });
  };

  // Default country: BR if nationality Brasileira (or unset), else US
  const country: AddressCountry =
    data.country || (data.nationality === "Brasileira" || !data.nationality ? "BR" : "US");

  const setCountry = (c: AddressCountry) => {
    onChange({ ...data, country: c, zip_code: "", address: "", district: "", city: "", state: "", house_number: "" });
    setAddressOpen(false);
  };

  const formatCep = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
  };

  const formatUsZip = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 9);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
  };

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const result = await res.json();
      if (!result.erro) {
        onChange({
          ...data,
          country: "BR",
          zip_code: formatCep(cep),
          address: result.logradouro || data.address,
          district: result.bairro || data.district,
          city: result.localidade || data.city,
          state: (result.uf || data.state || "").toUpperCase(),
        });
        setAddressOpen(true);
      }
    } catch { /* noop */ }
    setCepLoading(false);
  };

  const lookupUsZip = async (zip: string) => {
    const clean = zip.replace(/\D/g, "").slice(0, 5);
    if (clean.length !== 5) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
      if (res.ok) {
        const result = await res.json();
        const place = result.places?.[0];
        if (place) {
          onChange({
            ...data,
            country: "US",
            zip_code: formatUsZip(zip),
            city: place["place name"] || data.city,
            state: (place["state abbreviation"] || data.state || "").toUpperCase(),
          });
          setAddressOpen(true);
        }
      }
    } catch { /* noop */ }
    setCepLoading(false);
  };



  // ---- status flags ----
  const personalComplete = nameValid && emailValid && (data.phone || "").length > 6 && !!data.date_of_birth;
  const docComplete = !!data.document_number && !!data.nationality;
  const addressComplete = !!data.zip_code && !!data.address && !!data.house_number && !!data.city && !!data.state;

  // ---- DOB picker helpers ----
  const dobDate = useMemo(() => {
    if (!data.date_of_birth) return undefined;
    const d = parse(data.date_of_birth, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [data.date_of_birth]);

  const documentPlaceholder =
    documentType === "cpf" ? "000.000.000-00"
    : documentType === "passport" ? "BR123456"
    : "Número do documento";

  return (
    <div className="space-y-4">
      {/* ============ Você ============ */}
      <SectionCard
        icon={User}
        title="Você"
        subtitle="Como devemos te identificar e contatar"
        status={personalComplete ? "complete" : "default"}
      >
        {/* Nome */}
        <div>
          <FieldLabel>Nome completo</FieldLabel>
          <div className="relative">
            <input
              type="text"
              value={data.full_name || ""}
              onChange={(e) => update("full_name", e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="Como aparece no seu documento"
              autoComplete="name"
              className={cn(FIELD_BASE, "pr-11", showNameError ? FIELD_ERR : FIELD_OK)}
            />
            {nameValid && (
              <CheckCircle2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
            )}
          </div>
          {showNameError && (
            <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle size={12} /> Informe nome e sobrenome completos.
            </p>
          )}
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>E-mail</FieldLabel>
            <div className="relative">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={data.email || ""}
                onChange={(e) => update("email", e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="voce@email.com"
                className={cn(FIELD_BASE, "pr-11", showEmailError ? FIELD_ERR : FIELD_OK)}
              />
              {emailValid && (
                <CheckCircle2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
              )}
            </div>
            {showEmailError && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle size={12} /> E-mail inválido.
              </p>
            )}
            {emailSuggestion && !emailValid && (
              <button
                type="button"
                onClick={() => { update("email", emailSuggestion); setEmailTouched(true); }}
                className="mt-2 text-xs text-primary hover:underline text-left"
              >
                Você quis dizer <span className="font-medium">{emailSuggestion}</span>?
              </button>
            )}
          </div>

          <div>
            <FieldLabel>Celular (WhatsApp)</FieldLabel>
            <PhoneInput
              value={data.phone}
              onChange={(val) => update("phone", val)}
              inputClassName="h-14 px-4 text-base rounded-xl"
            />
          </div>
        </div>

        {/* Date of birth. mobile wheel picker / desktop calendar */}
        <div>
          <FieldLabel>Data de nascimento</FieldLabel>
          <BirthDatePicker
            value={data.date_of_birth}
            onChange={(iso) => update("date_of_birth", iso)}
            className={cn(FIELD_BASE, FIELD_OK)}
          />
        </div>
      </SectionCard>

      {/* ============ Documentos ============ */}
      <SectionCard
        icon={FileText}
        title="Documentos"
        subtitle="Necessários para validar sua reserva"
        status={docComplete && data.licenseFile ? "complete" : "default"}
      >
        {/* Nationality chips */}
        <div>
          <FieldLabel>Nacionalidade</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {NATIONALITIES.map((n) => {
              const isOther = n === "Outra";
              const active = isOther
                ? otherNationality
                : data.nationality === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (isOther) {
                      setOtherNationality(true);
                      if (NATIONALITIES.includes(data.nationality as any)) update("nationality", "");
                    } else {
                      setOtherNationality(false);
                      update("nationality", n);
                    }
                  }}
                  className={cn(
                    "h-11 px-4 rounded-full border text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-background text-foreground hover:border-primary/50"
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {otherNationality && (
            <input
              type="text"
              value={data.nationality || ""}
              onChange={(e) => update("nationality", e.target.value)}
              placeholder="Digite sua nacionalidade"
              className={cn(FIELD_BASE, FIELD_OK, "mt-3")}
            />
          )}
        </div>

        {/* Document type tabs */}
        <div>
          <FieldLabel>Tipo de documento</FieldLabel>
          <Tabs
            value={documentType}
            onValueChange={(v) => update("document_type", v as any)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 w-full h-12 rounded-xl bg-muted/50 p-1">
              <TabsTrigger value="cpf" className="rounded-lg text-sm h-full">CPF</TabsTrigger>
              <TabsTrigger value="passport" className="rounded-lg text-sm h-full">Passaporte</TabsTrigger>
              <TabsTrigger value="id" className="rounded-lg text-sm h-full">Outro ID</TabsTrigger>
            </TabsList>
          </Tabs>
          <input
            type="text"
            inputMode={documentType === "cpf" ? "numeric" : "text"}
            value={data.document_number || ""}
            onChange={(e) => update("document_number", e.target.value)}
            placeholder={documentPlaceholder}
            className={cn(FIELD_BASE, FIELD_OK, "mt-3")}
          />
        </div>

        {/* License upload */}
        <div>
          <FieldLabel>Habilitação (CNH). foto ou PDF</FieldLabel>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => onChange({ ...data, licenseFile: e.target.files?.[0] || null })}
            className="sr-only"
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onChange({ ...data, licenseFile: e.target.files?.[0] || null })}
            className="sr-only"
          />
          {data.licenseFile ? (
            <div className="flex items-center gap-3 h-14 px-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <span className="flex-1 text-sm text-foreground truncate">{data.licenseFile.name}</span>
              <button
                type="button"
                onClick={() => onChange({ ...data, licenseFile: null })}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="h-14 rounded-xl border-2 border-dashed border-border/60 bg-background hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-0.5"
              >
                <Camera size={16} className="text-primary" />
                <span className="text-xs font-medium text-foreground">Tirar foto</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-14 rounded-xl border-2 border-dashed border-border/60 bg-background hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-0.5"
              >
                <Upload size={16} className="text-primary" />
                <span className="text-xs font-medium text-foreground">Anexar arquivo</span>
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ============ Endereço ============ */}
      <SectionCard
        icon={MapPin}
        title="Endereço"
        subtitle={
          country === "BR" ? "Comece pelo CEP. preenchemos o resto"
          : country === "US" ? "Start with your ZIP code. we'll fill the rest"
          : "Preencha seu endereço"
        }
        status={addressComplete ? "complete" : "default"}
      >
        {/* Country selector */}
        <div>
          <FieldLabel>País</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "BR", label: "Brasil" },
              { v: "US", label: "Estados Unidos" },
              { v: "OTHER", label: "Outro" },
            ] as { v: AddressCountry; label: string }[]).map(({ v, label }) => {
              const active = country === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCountry(v)}
                  className={cn(
                    "h-11 px-4 rounded-full border text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/60 bg-background text-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ZIP / CEP + City */}
        {country !== "OTHER" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>{country === "BR" ? "CEP" : "ZIP code"}</FieldLabel>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={data.zip_code || ""}
                  maxLength={country === "BR" ? 9 : 10}
                  onChange={(e) => {
                    const val = country === "BR" ? formatCep(e.target.value) : formatUsZip(e.target.value);
                    update("zip_code", val);
                    if (country === "BR") lookupCep(val);
                    else lookupUsZip(val);
                  }}
                  placeholder={country === "BR" ? "00000-000" : "33101"}
                  className={cn(FIELD_BASE, FIELD_OK, "pr-11")}
                />
                {cepLoading && (
                  <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                )}
              </div>
            </div>
            <div>
              <FieldLabel>{country === "BR" ? "Cidade" : "City"}</FieldLabel>
              <input
                type="text"
                value={data.city || ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder={country === "BR" ? "Sua cidade" : "Miami"}
                className={cn(FIELD_BASE, FIELD_OK)}
              />
            </div>
          </div>
        )}

        {/* Collapsible: full address */}
        <Collapsible open={addressOpen || country === "OTHER"} onOpenChange={setAddressOpen}>
          {country !== "OTHER" && (
            <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium text-primary hover:text-primary/80 transition-colors py-2">
              <span>{country === "BR" ? "Endereço completo" : "Full address"}</span>
              <ChevronDown
                size={16}
                className={cn("transition-transform", addressOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
          )}
          <CollapsibleContent className="space-y-4 pt-2">
            {country === "OTHER" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Zip / Postal code</FieldLabel>
                  <input
                    type="text"
                    value={data.zip_code || ""}
                    onChange={(e) => update("zip_code", e.target.value)}
                    placeholder=""
                    className={cn(FIELD_BASE, FIELD_OK)}
                  />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <input
                    type="text"
                    value={data.city || ""}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder=""
                    className={cn(FIELD_BASE, FIELD_OK)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
              <div>
                <FieldLabel>
                  {country === "BR" ? "Rua / Logradouro"
                  : country === "US" ? "Street address" : "Street"}
                </FieldLabel>
                <input
                  type="text"
                  value={data.address || ""}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder={country === "US" ? "123 Ocean Drive" : "Avenida Paulista"}
                  className={cn(FIELD_BASE, FIELD_OK)}
                />
              </div>
              <div>
                <FieldLabel>{country === "BR" ? "Número" : country === "US" ? "Apt / Unit" : "Number"}</FieldLabel>
                <input
                  type="text"
                  value={data.house_number || ""}
                  onChange={(e) => update("house_number", e.target.value)}
                  placeholder={country === "US" ? "4B" : "123"}
                  className={cn(FIELD_BASE, FIELD_OK)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>
                  {country === "BR" ? "Complemento (opcional)" : "Complement (optional)"}
                </FieldLabel>
                <input
                  type="text"
                  value={data.complement || ""}
                  onChange={(e) => update("complement", e.target.value)}
                  placeholder={country === "BR" ? "Apto, bloco" : "Suite, floor"}
                  className={cn(FIELD_BASE, FIELD_OK)}
                />
              </div>
              <div>
                <FieldLabel>
                  {country === "BR" ? "Bairro" : country === "US" ? "Neighborhood (optional)" : "District"}
                </FieldLabel>
                <input
                  type="text"
                  value={data.district || ""}
                  onChange={(e) => update("district", e.target.value)}
                  placeholder={country === "US" ? "Brickell" : "Centro"}
                  className={cn(FIELD_BASE, FIELD_OK)}
                />
              </div>
            </div>

            <div>
              <FieldLabel>
                {country === "BR" ? "Estado (UF)" : country === "US" ? "State" : "State / Province"}
              </FieldLabel>
              <input
                type="text"
                value={data.state || ""}
                maxLength={country === "OTHER" ? undefined : 2}
                onChange={(e) => update("state", e.target.value.toUpperCase())}
                placeholder={country === "BR" ? "SP" : country === "US" ? "FL" : ""}
                className={cn(FIELD_BASE, FIELD_OK, "uppercase tracking-widest")}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SectionCard>



      {/* Trust footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <Lock size={12} className="text-emerald-500" />
        <span>Seus dados são criptografados e usados apenas para emitir o contrato.</span>
      </div>
    </div>
  );
}
