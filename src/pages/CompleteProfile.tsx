import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProfileTab from "@/components/account/ProfileTab";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@supabase/supabase-js";
import { AccountSkeleton } from "@/components/skeletons/AccountSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatPersonName } from "@/lib/formatName";

/**
 * Tela de "Completar perfil" exibida no primeiro login social (Google/Apple).
 * - Garante que existe um registro em `customers` para o usuário autenticado.
 * - Mostra o formulário (ProfileTab) com destaque para os campos obrigatórios.
 * - Quando o perfil estiver completo, redireciona para `?next=` ou /minha-conta.
 */
const CompleteProfile = () => {
  const { customer, loading, refreshCustomer, rawUser } = useAuth() as ReturnType<typeof useAuth> & { rawUser: User | null };
  const user = rawUser;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bootstrapping, setBootstrapping] = useState(true);

  const next = useMemo(() => {
    const raw = searchParams.get("next") || "/minha-conta";
    return raw.startsWith("/") ? raw : "/minha-conta";
  }, [searchParams]);

  // Garante linha em `customers` para usuários vindos de OAuth (sem signUp).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!user) {
        setBootstrapping(false);
        return;
      }
      if (customer) {
        setBootstrapping(false);
        return;
      }
      // Sem customer: cria registro mínimo a partir dos metadados do auth.
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const fullName =
        (meta.full_name as string) ||
        (meta.name as string) ||
        ([meta.given_name, meta.family_name].filter(Boolean).join(" ") as string) ||
        (user.email ? user.email.split("@")[0] : "Cliente");
      const email = user.email || (meta.email as string) || "";
      // Pode já existir (trigger); insere ignorando conflito por user_id
      const { error } = await supabase
        .from("customers")
        .insert({ user_id: user.id, email, full_name: fullName });
      if (error && !/duplicate|unique/i.test(error.message)) {
        // ignora — refresh abaixo cobre o caso de já existir
      }
      await refreshCustomer();
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, customer, refreshCustomer]);

  // Quando o perfil estiver completo, sai automaticamente desta tela.
  useEffect(() => {
    if (bootstrapping || loading) return;
    if (!customer) return;
    const complete = !!customer.phone && !!customer.document_number;
    if (complete) navigate(next, { replace: true });
  }, [bootstrapping, loading, customer, navigate, next]);

  if (loading || bootstrapping) return <AccountSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  const firstName = formatPersonName(customer?.full_name || (user.user_metadata?.full_name as string) || "")
    .split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-3 sm:px-4 pt-20 sm:pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-border/60 bg-card p-5 sm:p-7 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl gold-gradient text-primary-foreground grid place-items-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="admin-h1 text-xl sm:text-2xl">
                Bem-vindo{firstName ? `, ${firstName}` : ""}!
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Para finalizar reservas precisamos de alguns dados obrigatórios. telefone,
                documento (CPF ou passaporte), CNH e endereço. Leva menos de 2 minutos.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Telefone
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Documento
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> CNH
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Endereço
            </span>
          </div>
        </motion.div>

        <ProfileTab />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(next, { replace: true })}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            Pular por enquanto <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CompleteProfile;
