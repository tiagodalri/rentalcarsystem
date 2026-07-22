import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, Handshake, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";

export default function ParceiroLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "partner")
        .maybeSingle();
      if (data) navigate("/parceiro", { replace: true });
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      const uid = signInData.user?.id;
      if (!uid) throw new Error("Sessão inválida.");
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "partner")
        .maybeSingle();
      if (!role) {
        await supabase.auth.signOut();
        toast.error("Esta conta não é um parceiro autorizado.");
        return;
      }
      navigate("/parceiro", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "E-mail ou senha incorretos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Left: brand pitch */}
      <aside className="hidden lg:flex relative flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary))_0%,transparent_50%)]" />
        <div className="relative">
          <BrandLogo className="h-9" />
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <Handshake size={12} className="text-primary" /> Portal de Parceiros
          </div>
        </div>
        <div className="relative space-y-6 max-w-md">
          <h1 className="text-3xl xl:text-4xl font-semibold leading-tight text-foreground">
            Toda a frota da rede,<br />
            <span className="text-primary">uma comissão por reserva.</span>
          </h1>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="text-emerald-500" />
              </span>
              Comissão calculada e travada no ato da reserva.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-primary" />
              </span>
              Disponibilidade em tempo real em todas as locadoras da rede.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-primary" />
              </span>
              Extrato transparente com repasses pendentes e pagos.
            </li>
          </ul>
        </div>
        <p className="relative text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
          Acesso restrito · agências autorizadas
        </p>
      </aside>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8 lg:hidden">
            <BrandLogo className="h-9" />
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              <Handshake size={12} className="text-primary" /> Portal de Parceiros
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="text-2xl font-semibold text-foreground">Entrar</h2>
            <p className="text-sm text-muted-foreground mt-1">Acesse seu painel de comissões e reservas.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/60 focus:bg-background transition-colors"
                  placeholder="voce@parceiro.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-lg bg-muted/40 border border-border/40 text-sm outline-none focus:border-primary/60 focus:bg-background transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 gold-gradient text-primary-foreground rounded-lg text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-95 transition-opacity"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar no portal
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-border/40 bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Ainda não é parceiro?</p>
            <a
              href="/parceiro/cadastro"
              className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Cadastre sua agência
            </a>
          </div>

          <p className="text-[10px] text-center text-muted-foreground/70 mt-4 uppercase tracking-[0.2em]">
            Acesso somente para agências autorizadas
          </p>
        </div>
      </div>
    </div>
  );
}
