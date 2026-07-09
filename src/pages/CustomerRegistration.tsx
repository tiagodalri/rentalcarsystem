import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Check, Upload, Camera, Loader2, User, Mail, Phone, FileText, MapPin, Calendar, Globe, Lock, Eye, EyeOff } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDocumentOcr, type OcrFields } from "@/hooks/useDocumentOcr";
import OcrReviewPanel from "@/components/admin/OcrReviewPanel";
import BrandLogo from "@/components/BrandLogo";
import { uploadCnh } from "@/lib/cnhStorage";
import { clearFormDraft, useFormDraft } from "@/hooks/useFormDraft";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

type RegistrationForm = {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  document_number: string;
  nationality: string;
  date_of_birth: string;
  address: string;
  zip_code: string;
  house_number: string;
  complement: string;
  driver_license: string;
  driver_license_expiry: string;
};

type RegistrationDraft = Omit<RegistrationForm, "password" | "confirmPassword">;

const REGISTRATION_DRAFT_KEY = "customer-registration-v2";

const emptyRegistrationForm: RegistrationForm = {
  full_name: "", email: "", password: "", confirmPassword: "",
  phone: "", document_number: "",
  nationality: "", date_of_birth: "", address: "", zip_code: "",
  house_number: "", complement: "", driver_license: "", driver_license_expiry: "",
};

const passwordSchema = z
  .string()
  .min(8, "Senha precisa de no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha precisa de uma letra maiúscula")
  .regex(/[a-z]/, "Senha precisa de uma letra minúscula")
  .regex(/[0-9]/, "Senha precisa de um número");

const CustomerRegistration = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { language } = useLanguage();
  const [form, setForm] = useState<RegistrationForm>({ ...emptyRegistrationForm });
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const registrationDraft = useMemo<RegistrationDraft>(() => {
    const { password: _password, confirmPassword: _confirmPassword, ...draft } = form;
    return draft;
  }, [form]);

  useFormDraft(
    REGISTRATION_DRAFT_KEY,
    registrationDraft,
    (draft) => setForm((prev) => ({ ...prev, ...draft })),
    !success,
    {
      debounceMs: 150,
      isEmpty: (draft) => Object.values(draft).every((value) => !String(value ?? "").trim()),
    },
  );

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const addr = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(", ");
        setForm(prev => ({ ...prev, address: addr }));
      }
    } catch {}
    setCepLoading(false);
  };

  const { loading: ocrLoading, result: ocrResult, runOcr, reset: resetOcr } = useDocumentOcr();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    setLicenseFile(file);
    resetOcr();
    if (file.type.startsWith("image/")) await runOcr(file);
  };

  const applyOcr = (values: Partial<Record<keyof OcrFields, string>>) => {
    setForm((prev) => ({ ...prev, ...values } as any));
    resetOcr();
    toast({ title: "Dados aplicados", description: "Confira antes de enviar o cadastro." });
  };

  const isFormValid = useMemo(() => {
    if (!form.full_name.trim()) return false;
    if (!form.email.trim()) return false;
    if (!form.phone.trim()) return false;
    if (!form.driver_license.trim()) return false;
    if (!form.driver_license_expiry || new Date(form.driver_license_expiry) <= new Date()) return false;
    if (!form.password || form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) return false;
    if (form.password !== form.confirmPassword) return false;
    return true;
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim()) return setError("Nome é obrigatório.");
    if (!form.email.trim()) return setError("E-mail é obrigatório.");
    if (!form.phone.trim()) return setError("Telefone é obrigatório.");
    if (!form.driver_license.trim()) return setError("Número da CNH / Driver License é obrigatório.");
    if (!form.driver_license_expiry) return setError("Validade da CNH é obrigatória.");
    if (new Date(form.driver_license_expiry) <= new Date()) return setError("CNH vencida — informe uma data válida.");

    const pwdParse = passwordSchema.safeParse(form.password);
    if (!pwdParse.success) return setError(pwdParse.error.errors[0].message);
    if (form.password !== form.confirmPassword) return setError("As senhas não coincidem.");

    setSubmitting(true);

    try {
      // 1. Sign up first — creates auth user, authenticates, links/creates customer row
      await signUp(form.email, form.password, form.full_name.trim(), {
        phone: form.phone.trim(),
        document_number: form.document_number.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        address: form.address.trim() || undefined,
        zip_code: form.zip_code.trim() || undefined,
        house_number: form.house_number.trim() || undefined,
        complement: form.complement.trim() || undefined,
        driver_license: form.driver_license.trim() || undefined,
        driver_license_expiry: form.driver_license_expiry || undefined,
        language: language === "en" ? "en" : "pt",
      });

      // 2. Upload CNH AFTER signup so RLS sees an authenticated user.
      // Stored privately in customer-licenses; we save the storage path, not a public URL.
      if (licenseFile) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Sessão não encontrada após cadastro.");
          const path = await uploadCnh(licenseFile);
          if (!path) throw new Error("upload retornou vazio");
          await supabase
            .from("customers")
            .update({ driver_license_file_url: path })
            .eq("user_id", user.id);
        } catch (uploadErr: any) {
          console.error("CNH upload failed:", uploadErr);
          toast({
            title: "Conta criada com sucesso",
            description: "A foto da CNH não pôde ser anexada. Tente novamente em Minha Conta.",
          });
        }
      }

      clearFormDraft(REGISTRATION_DRAFT_KEY);
      setSuccess(true);
      setTimeout(() => navigate("/minha-conta"), 1500);
    } catch (err: any) {
      const msg = err?.message?.includes("already registered") || err?.message?.includes("already been registered")
        ? "Este e-mail já está cadastrado. Faça login."
        : err?.message || "Erro ao cadastrar.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro Realizado!</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo(a), <strong>{form.full_name}</strong>! Redirecionando para sua conta...
          </p>
        </div>
      </div>
    );
  }

  const fields: Array<{ key: keyof typeof form; label: string; icon: any; type: string; placeholder: string }> = [
    { key: "full_name", label: "Nome Completo *", icon: User, type: "text", placeholder: "Seu nome completo" },
    { key: "email", label: "E-mail *", icon: Mail, type: "email", placeholder: "seu@email.com" },
    { key: "phone", label: "Celular (WhatsApp) *", icon: Phone, type: "tel", placeholder: "+55 11 99999-0000" },
    { key: "date_of_birth", label: "Data de Nascimento", icon: Calendar, type: "date", placeholder: "" },
    { key: "nationality", label: "Nacionalidade", icon: Globe, type: "text", placeholder: "Brasileira" },
    { key: "document_number", label: "Documento (CPF / Passport / ID) *", icon: FileText, type: "text", placeholder: "CPF, Passport ou ID/SSN" },
    { key: "driver_license", label: "Número da CNH / Driver License *", icon: FileText, type: "text", placeholder: "Número do documento" },
    { key: "driver_license_expiry", label: "Validade da CNH *", icon: Calendar, type: "date", placeholder: "" },
    { key: "zip_code", label: "CEP / Zip Code", icon: MapPin, type: "text", placeholder: "00000-000" },
    { key: "address", label: "Rua / Logradouro", icon: MapPin, type: "text", placeholder: "Rua, bairro, cidade, estado" },
    { key: "house_number", label: "Número", icon: MapPin, type: "text", placeholder: "123" },
    { key: "complement", label: "Complemento", icon: MapPin, type: "text", placeholder: "Apto, bloco, sala..." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/50">
        <div className="container mx-auto px-4 py-6 flex items-center justify-center">
          <BrandLogo size="md" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Cadastre-se para reservar veículos e gerenciar suas locações.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Já tem conta?{" "}
            <button onClick={() => navigate("/login")} className="text-primary hover:text-primary/80 font-medium py-2 px-1 min-h-11 inline-flex items-center">
              Entrar
            </button>
          </p>
        </div>

        <div className="mb-6">
          <SocialAuthButtons label="Cadastrar com" redirectTo="/minha-conta" />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">ou preencha os dados</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ key, label, icon: Icon, type, placeholder }) => (
            <div key={key}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Icon size={11} className="text-primary/60" />
                {label}
              </label>
              <div className="relative">
                {key === "phone" ? (
                  <PhoneInput
                    value={form[key]}
                    onChange={(val) => update(key, val)}
                    inputClassName="h-10 px-3 text-sm"
                  />
                ) : (
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => {
                      update(key, e.target.value);
                      if (key === "zip_code") lookupCep(e.target.value);
                    }}
                    placeholder={placeholder}
                    className="w-full h-10 px-3 rounded-lg border border-border/40 bg-card text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  />
                )}
                {key === "zip_code" && cepLoading && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                )}
              </div>
            </div>
          ))}

          {/* Password */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock size={11} className="text-primary/60" />
              Senha *
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-border/40 bg-card text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Mínimo 8 caracteres, com maiúscula, minúscula e número.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock size={11} className="text-primary/60" />
              Confirmar senha *
            </label>
            <div className="relative">
              <input
                type={showPwd2 ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-border/40 bg-card text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd2(!showPwd2)}
                aria-label={showPwd2 ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                {showPwd2 ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Driver License Upload */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={11} className="text-primary/60" />
              Habilitação (CNH) — Foto ou PDF
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              id="cameraInputReg"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <label
                htmlFor="cameraInputReg"
                className="h-10 px-3 rounded-lg border border-dashed border-border/60 bg-card/50 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-2 cursor-pointer"
              >
                <Camera size={14} />
                Câmera
              </label>
              <label
                className="flex-1 h-10 px-3 rounded-lg border border-dashed border-border/60 bg-card/50 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload size={14} />
                {licenseFile ? licenseFile.name : "Anexar arquivo"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {ocrLoading && (
              <p className="text-[11px] text-primary mt-2 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Lendo documento com IA...
              </p>
            )}
            {ocrResult && (
              <div className="mt-3">
                <OcrReviewPanel
                  extracted={ocrResult}
                  current={{
                    full_name: form.full_name,
                    document_number: form.document_number,
                    driver_license: form.driver_license,
                    driver_license_expiry: form.driver_license_expiry,
                    date_of_birth: form.date_of_birth,
                  }}
                  onApply={applyOcr}
                  onDismiss={resetOcr}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full h-11 gold-gradient text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 mt-6"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar conta"
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6">
          Sua Marca · Orlando & Miami · Seus dados estão protegidos.
        </p>
      </div>
    </div>
  );
};

export default CustomerRegistration;
