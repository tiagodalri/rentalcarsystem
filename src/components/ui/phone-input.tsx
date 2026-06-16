import { useState, useRef, useEffect } from "react";
import { ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatPhone, getPhoneRule, isValidPhone } from "@/lib/formValidators";


const COUNTRIES = [
  { code: "+55", flag: "🇧🇷", name: "Brasil", iso: "BR" },
  { code: "+1", flag: "🇺🇸", name: "Estados Unidos", iso: "US" },
  { code: "+54", flag: "🇦🇷", name: "Argentina", iso: "AR" },
  { code: "+56", flag: "🇨🇱", name: "Chile", iso: "CL" },
  { code: "+57", flag: "🇨🇴", name: "Colômbia", iso: "CO" },
  { code: "+52", flag: "🇲🇽", name: "México", iso: "MX" },
  { code: "+595", flag: "🇵🇾", name: "Paraguai", iso: "PY" },
  { code: "+598", flag: "🇺🇾", name: "Uruguai", iso: "UY" },
  { code: "+51", flag: "🇵🇪", name: "Peru", iso: "PE" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela", iso: "VE" },
  { code: "+593", flag: "🇪🇨", name: "Equador", iso: "EC" },
  { code: "+591", flag: "🇧🇴", name: "Bolívia", iso: "BO" },
  { code: "+44", flag: "🇬🇧", name: "Reino Unido", iso: "GB" },
  { code: "+49", flag: "🇩🇪", name: "Alemanha", iso: "DE" },
  { code: "+33", flag: "🇫🇷", name: "França", iso: "FR" },
  { code: "+34", flag: "🇪🇸", name: "Espanha", iso: "ES" },
  { code: "+39", flag: "🇮🇹", name: "Itália", iso: "IT" },
  { code: "+351", flag: "🇵🇹", name: "Portugal", iso: "PT" },
  { code: "+81", flag: "🇯🇵", name: "Japão", iso: "JP" },
  { code: "+86", flag: "🇨🇳", name: "China", iso: "CN" },
  { code: "+91", flag: "🇮🇳", name: "Índia", iso: "IN" },
  { code: "+61", flag: "🇦🇺", name: "Austrália", iso: "AU" },
  { code: "+971", flag: "🇦🇪", name: "Emirados Árabes", iso: "AE" },
  { code: "+972", flag: "🇮🇱", name: "Israel", iso: "IL" },
  { code: "+27", flag: "🇿🇦", name: "África do Sul", iso: "ZA" },
  { code: "+41", flag: "🇨🇭", name: "Suíça", iso: "CH" },
  { code: "+43", flag: "🇦🇹", name: "Áustria", iso: "AT" },
  { code: "+31", flag: "🇳🇱", name: "Holanda", iso: "NL" },
  { code: "+46", flag: "🇸🇪", name: "Suécia", iso: "SE" },
  { code: "+47", flag: "🇳🇴", name: "Noruega", iso: "NO" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, className = "", inputClassName = "", placeholder = "11 99999-0000" }: PhoneInputProps) {
  // Parse existing value to extract country code
  const detectCountry = () => {
    for (const c of COUNTRIES) {
      if (value.startsWith(c.code)) return c;
    }
    return COUNTRIES[0]; // default BR
  };

  const [selected, setSelected] = useState(detectCountry);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Strip country code from display value
  const phoneNumber = value.startsWith(selected.code)
    ? value.slice(selected.code.length).trim()
    : value.replace(/^\+\d{1,4}\s?/, "");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (country: typeof COUNTRIES[0]) => {
    setSelected(country);
    setOpen(false);
    setSearch("");
    onChange(`${country.code} ${phoneNumber}`);
  };

  const handlePhoneChange = (num: string) => {
    onChange(`${selected.code} ${num}`);
  };

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search) ||
          c.iso.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div className={`relative flex ${className}`} ref={ref}>
      {/* Country selector */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 rounded-l-lg border border-r-0 border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors shrink-0"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="text-xs text-muted-foreground font-medium">{selected.code}</span>
        <ChevronDown size={12} className="text-muted-foreground/60" />
      </button>

      {/* Phone number input */}
      <input
        type="tel"
        value={phoneNumber}
        onChange={(e) => handlePhoneChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 rounded-r-lg border border-border/40 bg-card text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all ${inputClassName}`}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 max-h-64 overflow-hidden rounded-xl border border-border/40 bg-card shadow-xl flex flex-col">
          <div className="p-2 border-b border-border/20">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país..."
              autoFocus
              className="w-full h-8 px-2.5 rounded-md border border-border/30 bg-background text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((c) => (
              <button
                key={c.iso}
                type="button"
                onClick={() => handleSelect(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                  c.iso === selected.iso ? "bg-primary/5" : ""
                }`}
              >
                <span className="text-lg leading-none">{c.flag}</span>
                <span className="text-xs font-medium text-foreground flex-1">{c.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum país encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
