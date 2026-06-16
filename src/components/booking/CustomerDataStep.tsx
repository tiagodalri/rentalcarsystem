import { useState, useRef } from "react";
import { User, Mail, Phone, Calendar, Globe, FileText, MapPin, Upload, Camera, Loader2, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidEmail, suggestEmail } from "@/lib/formValidators";


export interface CustomerData {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  nationality: string;
  document_number: string;
  address: string;       // street / logradouro
  house_number: string;
  complement: string;
  zip_code: string;
  district: string;      // bairro
  city: string;          // cidade
  state: string;         // UF (2 letras)
  licenseFile: File | null;
}

interface Props {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
}

const fields = [
  { key: "full_name", label: "Nome Completo *", icon: User, type: "text", placeholder: "Nome e sobrenome (como no documento)", colSpan: 2 },
  { key: "email", label: "E-mail *", icon: Mail, type: "email", placeholder: "voce@email.com", colSpan: 2 },
  { key: "phone", label: "Celular (WhatsApp) *", icon: Phone, type: "tel", placeholder: "+55 11 99999-0000", colSpan: 2 },
  { key: "date_of_birth", label: "Data de Nascimento *", icon: Calendar, type: "date", placeholder: "", colSpan: 2 },
  { key: "nationality", label: "Nacionalidade", icon: Globe, type: "text", placeholder: "Brasileira", colSpan: 2 },
  { key: "document_number", label: "Documento (CPF / Passport / ID) *", icon: FileText, type: "text", placeholder: "Apenas números", colSpan: 2 },
  { key: "zip_code", label: "CEP / Zip Code *", icon: MapPin, type: "text", placeholder: "00000-000", colSpan: 2 },
  { key: "address", label: "Rua / Logradouro *", icon: MapPin, type: "text", placeholder: "Avenida Paulista", colSpan: 2 },
  { key: "house_number", label: "Número *", icon: MapPin, type: "text", placeholder: "123", colSpan: 2 },
  { key: "complement", label: "Complemento", icon: MapPin, type: "text", placeholder: "Apto, bloco, sala (opcional)", colSpan: 2 },
  { key: "district", label: "Bairro", icon: Building2, type: "text", placeholder: "Centro", colSpan: 2 },
  { key: "city", label: "Cidade *", icon: Building2, type: "text", placeholder: "São Paulo", colSpan: 2 },
  { key: "state", label: "Estado (UF) *", icon: Building2, type: "text", placeholder: "SP", colSpan: 2 },
] as const;

export default function CustomerDataStep({ data, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const emailSuggestion = suggestEmail(data.email || "");
  const emailValid = isValidEmail(data.email || "");
  const showEmailError = emailTouched && (data.email || "").length > 0 && !emailValid;
  const nameParts = (data.full_name || "").trim().split(/\s+/).filter(p => p.length >= 2);
  const nameValid = nameParts.length >= 2;
  const showNameError = nameTouched && (data.full_name || "").trim().length > 0 && !nameValid;



  const update = (key: string, value: string) => {
    onChange({ ...data, [key]: value });
  };

  const formatCep = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
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
          zip_code: formatCep(cep),
          address: result.logradouro || data.address,
          district: result.bairro || data.district,
          city: result.localidade || data.city,
          state: (result.uf || data.state || "").toUpperCase(),
        });
      }
    } catch { /* noop */ }
    setCepLoading(false);
  };


  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <User size={16} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">Dados do Condutor</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Preencha para finalizar sua reserva. Digite o CEP que rua, bairro, cidade e estado são preenchidos sozinhos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        {fields.map(({ key, label, icon: Icon, type, placeholder, colSpan }) => (
          <div key={key} className={colSpan === 2 ? "sm:col-span-2" : ""}>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Icon size={11} className="text-primary/60" />
              {label}
            </label>
            <div className="relative">
              {key === "phone" ? (
                <PhoneInput
                  value={(data as any)[key]}
                  onChange={(val) => update(key, val)}
                  inputClassName="h-11 px-3 text-sm"
                />
              ) : (
                <input
                  type={type}
                  inputMode={key === "email" ? "email" : key === "zip_code" || key === "document_number" || key === "house_number" ? "numeric" : undefined}
                  autoComplete={key === "email" ? "email" : undefined}
                  value={(data as any)[key] ?? ""}
                  maxLength={key === "state" ? 2 : key === "zip_code" ? 9 : undefined}
                  onBlur={() => { if (key === "email") setEmailTouched(true); if (key === "full_name") setNameTouched(true); }}
                  onChange={(e) => {
                    let val: string = e.target.value;
                    if (key === "state") val = val.toUpperCase();
                    if (key === "zip_code") val = formatCep(val);
                    update(key, val);
                    if (key === "zip_code") lookupCep(val);
                  }}

                  placeholder={placeholder}
                  className={`w-full h-11 px-3 pr-9 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                    (key === "email" && showEmailError) || (key === "full_name" && showNameError)
                      ? "border-destructive/60 focus:ring-destructive/25 focus:border-destructive/60"
                      : "border-border/50 focus:ring-primary/25 focus:border-primary/40"
                  }`}
                />
              )}
              {key === "zip_code" && cepLoading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
              )}
              {key === "email" && emailValid && (
                <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
              {key === "full_name" && nameValid && (
                <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
              )}
            </div>
            {key === "full_name" && showNameError && (
              <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle size={11} />
                Informe nome e sobrenome completos (ex.: Miqueias Santos).
              </p>
            )}
            {key === "email" && showEmailError && (
              <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle size={11} />
                E-mail inválido. Use o formato nome@dominio.com
              </p>
            )}
            {key === "email" && emailSuggestion && !emailValid && (
              <button
                type="button"
                onClick={() => { update("email", emailSuggestion); setEmailTouched(true); }}
                className="mt-1 text-[11px] text-primary hover:underline text-left"
              >
                Você quis dizer <span className="font-medium">{emailSuggestion}</span>?
              </button>
            )}
          </div>
        ))}
      </div>


      {/* License upload */}
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <FileText size={11} className="text-primary/60" />
          Habilitação (CNH) — Foto ou PDF
        </label>
        {/* sr-only inputs — iOS/Safari ignora .click() em input com display:none.
            Use sr-only para manter no fluxo de acessibilidade e abrir a câmera nativa. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange({ ...data, licenseFile: file });
          }}
          className="sr-only"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange({ ...data, licenseFile: file });
          }}
          className="sr-only"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="h-11 px-3 rounded-md border border-dashed border-border/50 bg-background/50 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all flex items-center gap-2"
          >
            <Camera size={13} />
            Câmera
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 h-11 px-3 rounded-md border border-dashed border-border/50 bg-background/50 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all flex items-center gap-2 truncate"
          >
            <Upload size={13} />
            <span className="truncate">{data.licenseFile ? data.licenseFile.name : "Anexar arquivo"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
