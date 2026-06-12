import { useState, useRef } from "react";
import { User, Mail, Phone, Calendar, Globe, FileText, MapPin, Upload, Camera, Loader2, Building2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

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
  { key: "full_name", label: "Nome Completo *", icon: User, type: "text", placeholder: "Como está no documento", colSpan: 2 },
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
  const [cepLoading, setCepLoading] = useState(false);

  const update = (key: string, value: string) => {
    onChange({ ...data, [key]: value });
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
          zip_code: cep,
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
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <User size={14} className="text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-foreground">Dados do Condutor</h3>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-2 mb-2">
        Preencha para finalizar sua reserva. Digite o CEP que rua, bairro, cidade e estado são preenchidos sozinhos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(({ key, label, icon: Icon, type, placeholder, colSpan }) => (
          <div key={key} className={colSpan === 2 ? "sm:col-span-2" : ""}>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <Icon size={9} className="text-primary/50" />
              {label}
            </label>
            <div className="relative">
              {key === "phone" ? (
                <PhoneInput
                  value={(data as any)[key]}
                  onChange={(val) => update(key, val)}
                  inputClassName="h-8 px-2.5 text-xs"
                />
              ) : (
                <input
                  type={type}
                  value={(data as any)[key] ?? ""}
                  maxLength={key === "state" ? 2 : undefined}
                  onChange={(e) => {
                    const val = key === "state" ? e.target.value.toUpperCase() : e.target.value;
                    update(key, val);
                    if (key === "zip_code") lookupCep(e.target.value);
                  }}
                  placeholder={placeholder}
                  className="w-full h-8 px-2.5 rounded-md border border-border/40 bg-background text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30 transition-all"
                />
              )}
              {key === "zip_code" && cepLoading && (
                <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary animate-spin" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* License upload */}
      <div>
        <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
          <FileText size={9} className="text-primary/50" />
          Habilitação (CNH) — Foto ou PDF
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange({ ...data, licenseFile: file });
          }}
          className="hidden"
        />
        <input
          id="cameraInputBooking"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange({ ...data, licenseFile: file });
          }}
          className="hidden"
        />
        <div className="flex gap-2">
          <label
            htmlFor="cameraInputBooking"
            className="h-8 px-2.5 rounded-md border border-dashed border-border/50 bg-background/50 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Camera size={11} />
            Câmera
          </label>
          <label className="flex-1 h-8 px-2.5 rounded-md border border-dashed border-border/50 bg-background/50 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer">
            <Upload size={11} />
            {data.licenseFile ? data.licenseFile.name : "Anexar arquivo"}
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onChange({ ...data, licenseFile: file });
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
