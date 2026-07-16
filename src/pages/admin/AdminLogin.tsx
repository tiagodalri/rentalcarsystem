import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import BrandLogo from "@/components/BrandLogo";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, roles, loading, authError, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const restrictedToastShown = useRef(false);
  const autoLoginTried = useRef(false);

  // Demo/whitelabel: bypass login screen for presentation purposes.
  // Auto-signs in with the demo admin account if no session is active.
  useEffect(() => {
    if (loading || user || autoLoginTried.current) return;
    autoLoginTried.current = true;
    signIn("adm@adm.com", "admadm123").catch((err) => {
      console.warn("[AdminLogin] auto-login falhou:", err?.message || err);
    });
  }, [loading, user, signIn]);



  useEffect(() => {
    if (loading || !user || authError) return;
    if (roles.length > 0) {
      navigate("/admin", { replace: true });
    } else {
      if (!restrictedToastShown.current) {
        restrictedToastShown.current = true;
        sonnerToast.error("Esta área é restrita à equipe GoDrive. Faça login com sua conta de equipe.");
      }
      navigate("/", { replace: true });
    }
  }, [loading, user, roles, authError, navigate]);

  useEffect(() => {
    if (!authError || !user || restrictedToastShown.current) return;
    restrictedToastShown.current = true;
    sonnerToast.error("Login feito, mas não foi possível carregar suas permissões. Tente atualizar a página.");
  }, [authError, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email.trim(), password.trim());
    } catch (err: any) {
      toast({
        title: "Erro de autenticação",
        description: err.message || "E-mail ou senha incorretos.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-medium tracking-tight text-muted-foreground font-light">
            ADMIN
          </h1>
          <p className="text-muted-foreground text-sm mt-2">Acesso restrito à administração</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="admin@rentalcarsystem.lovable.app"
                  required
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
                  required
                  className="w-full h-10 pl-10 pr-10 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
          © {new Date().getFullYear()} GoDrive · Painel Administrativo
        </p>
      </div>
    </div>
  );
}
