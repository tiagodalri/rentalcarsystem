import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut, Handshake, Search, ArrowRight, Wallet } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";


export default function ParceiroDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "partner")
        .maybeSingle();
      if (!role) { navigate("/parceiro/login", { replace: true }); return; }
      setEmail(session.user.email ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/parceiro/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-7" />
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
            <Handshake size={13} className="text-primary" /> Parceiro
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Bem-vindo ao Portal de Parceiros</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sessão ativa: <span className="text-foreground">{email}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/40 bg-card p-6 flex flex-col items-center text-center gap-3">
            <Search className="h-9 w-9 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Buscar frota disponível</h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                Disponibilidade em tempo real em todas as locadoras da rede.
              </p>
            </div>
            <Button
              onClick={() => navigate("/parceiro/buscar")}
              className="gold-gradient text-primary-foreground font-bold uppercase tracking-wider gap-2"
            >
              Buscar frota <ArrowRight size={16} />
            </Button>
          </div>

          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 flex flex-col items-center text-center gap-3">
            <Wallet className="h-9 w-9 text-emerald-500" />
            <div>
              <h2 className="text-base font-semibold">Minhas comissões</h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
                Extrato completo com valores pendentes e já repassados.
              </p>
            </div>
            <Button
              onClick={() => navigate("/parceiro/comissoes")}
              variant="outline"
              className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold uppercase tracking-wider gap-2"
            >
              Ver extrato <ArrowRight size={16} />
            </Button>
          </div>
        </div>

      </main>
    </div>
  );
}
