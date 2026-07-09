import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BrandLogo from "@/components/BrandLogo";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, loading, signIn, resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from || "/minha-conta";

  useEffect(() => {
    if (!loading && isLoggedIn) navigate(from, { replace: true });
  }, [isLoggedIn, loading, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err?.message?.includes("Invalid login")
        ? "E-mail ou senha incorretos."
        : err?.message || "Erro ao entrar.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
      setMode("login");
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar e-mail.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary font-semibold uppercase tracking-[0.25em]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>SUA MARCA</span>
              <span className="text-muted-foreground font-light ml-1">RENTAL CAR</span>
            </h1>
          </a>
          <p className="text-muted-foreground text-sm mt-2">
            {mode === "login" ? "Acesse sua conta para gerenciar suas reservas" : "Recupere o acesso à sua conta"}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg p-8">
          {mode === "login" ? (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-6">Entrar</h2>

              <SocialAuthButtons label="Entrar com" />

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">ou com e-mail</span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full h-10 pl-10 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full h-10 pl-10 pr-10 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(null); }}
                    className="text-xs text-primary hover:text-primary/80 transition-colors py-2 px-1 -mr-1 min-h-11 inline-flex items-center"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Entrar
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-border/30 text-center">
                <p className="text-xs text-muted-foreground">
                  Não tem conta?{" "}
                  <button
                    onClick={() => navigate("/cadastro")}
                    className="text-primary hover:text-primary/80 font-medium transition-colors py-2 px-1 min-h-11 inline-flex items-center"
                  >
                    Criar conta
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode("login"); setError(null); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </button>

              <h2 className="text-lg font-semibold text-foreground mb-2">Recuperar senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Informe seu e-mail e enviaremos instruções para redefinir sua senha.
              </p>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full h-10 pl-10 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Enviar link de recuperação
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
          © {new Date().getFullYear()} Sua Marca. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
