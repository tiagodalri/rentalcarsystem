import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthUser {
  name: string;
  email: string;
  phone: string;
  document: string;
  nationality: string;
}

export interface CustomerRecord {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  address: string | null;
  zip_code: string | null;
  house_number: string | null;
  complement: string | null;
  driver_license: string | null;
  driver_license_file_url: string | null;
}

interface SignUpExtra {
  phone?: string;
  document_number?: string;
  nationality?: string;
  date_of_birth?: string;
  address?: string;
  zip_code?: string;
  house_number?: string;
  complement?: string;
  language?: "pt" | "en";
}

let cachedCustomer: { userId: string; customer: CustomerRecord | null } | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    const hydrate = async (currentSession: Session | null) => {
      const currentUser = currentSession?.user ?? null;
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentUser);

      if (!currentUser) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      // Só usa cache se houver customer real cacheado (nunca cacheia null)
      if (cachedCustomer && cachedCustomer.userId === currentUser.id && cachedCustomer.customer) {
        setCustomer(cachedCustomer.customer);
        setLoading(false);
        return;
      }

      // Fetch customer record (deferred to avoid deadlock w/ auth event)
      setTimeout(async () => {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        const rec = (data as CustomerRecord) ?? null;
        // Só cacheia se encontrou customer real
        if (rec) {
          cachedCustomer = { userId: currentUser.id, customer: rec };
        }
        if (mounted) {
          setCustomer(rec);
          setLoading(false);
        }
      }, 0);
    };

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "INITIAL_SESSION") return;
      cachedCustomer = null;
      hydrate(sess);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        hydrate(sess);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    cachedCustomer = null;
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, extra: SignUpExtra = {}) => {
      cachedCustomer = null;
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;

      const newUserId = data.user?.id;
      if (!newUserId) throw new Error("Falha ao criar conta. Tente novamente.");

      // The trigger may have linked an existing customer; check first
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", newUserId)
        .maybeSingle();

      if (existing) {
        // Update with new info from form
        const { error: updErr } = await supabase
          .from("customers")
          .update({
            full_name: fullName,
            phone: extra.phone || null,
            document_number: extra.document_number || null,
            nationality: extra.nationality || null,
            date_of_birth: extra.date_of_birth || null,
            address: extra.address || null,
            zip_code: extra.zip_code || null,
            house_number: extra.house_number || null,
            complement: extra.complement || null,
          })
          .eq("id", existing.id);
        if (updErr) throw new Error("Conta criada, mas falhou ao salvar perfil: " + updErr.message);
      } else {
        const { error: insErr } = await supabase.from("customers").insert({
          user_id: newUserId,
          full_name: fullName,
          email: cleanEmail,
          phone: extra.phone || null,
          document_number: extra.document_number || null,
          nationality: extra.nationality || null,
          date_of_birth: extra.date_of_birth || null,
          address: extra.address || null,
          zip_code: extra.zip_code || null,
          house_number: extra.house_number || null,
          complement: extra.complement || null,
        });
        if (insErr) throw new Error("Conta criada, mas falhou ao salvar perfil: " + insErr.message);

        // Fire-and-forget: send welcome email only for brand-new customers
        const emailLang = extra.language === "en" ? "en" : "pt";
        supabase.functions.invoke("send-email", {
          body: {
            templateName: "welcome",
            recipientEmail: cleanEmail,
            idempotencyKey: `welcome-${newUserId}`,
            language: emailLang,
            templateData: { firstName: fullName.split(" ")[0] },
          },
        }).catch((err: unknown) => console.warn("welcome email failed silently:", err));
      }

      // Força re-hidratação do customer após INSERT
      cachedCustomer = null;
      const { data: { session: refreshedSession } } = await supabase.auth.getSession();
      if (refreshedSession?.user) {
        const { data: refreshedCustomer } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", refreshedSession.user.id)
          .maybeSingle();
        if (refreshedCustomer) {
          cachedCustomer = { userId: refreshedSession.user.id, customer: refreshedCustomer as CustomerRecord };
        }
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    cachedCustomer = null;
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw error;
  }, []);

  // Backward-compat AuthUser for existing components
  const authUser: AuthUser | null = user
    ? {
        name: customer?.full_name || (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Cliente",
        email: customer?.email || user.email || "",
        phone: customer?.phone || "",
        document: customer?.document_number || "",
        nationality: customer?.nationality || "",
      }
    : null;

  return {
    user: authUser,
    rawUser: user,
    session,
    customer,
    isLoggedIn: !!user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    // legacy alias
    logout: signOut,
  };
}
